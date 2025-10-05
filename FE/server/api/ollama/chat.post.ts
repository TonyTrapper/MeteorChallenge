// server/api/ollama/chat.post.ts
import {
  defineEventHandler, readBody, sendStream,
  setResponseHeader, setResponseStatus, getRequestURL
} from 'h3'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }
type ChatBody = {
  model?: string
  messages?: Msg[]
  stream?: boolean
  options?: Record<string, any>
}

const AU_KM = 149597870.7
const LD_AU = 0.002569
const MAX_ITEMS = 12 // 🔧 límite duro para no saturar al modelo

function buildToolSystemPrompt() {
  return `
Eres un asistente para astronomía de "Meteor Madness".
Si para responder hace falta información de "close approaches" (acercamientos cercanos), emite **UNA sola línea**:
CAD_CALL {"date_min":"now","date_max":"+60","dist_max":"0.05","body":"Earth","des":"","sort":"date","limit":50}
AJUSTA parámetros a lo que pida el usuario: si pide "7 días/esta semana" usa "date_max":"+7"; si pide "10 LD" usa "dist_max":"10LD"; si pregunta por "más cercano" usa "sort":"dist".
Campos permitidos: date_min, date_max, dist_max, body, des, sort, limit, v-rel-min, v-rel-max, h-min, h-max, pha, neo, diameter, fullname.
Si NO necesitas datos, responde normalmente.
Cuando recibas CAD_RESULT, muestra una lista breve (máx. 12) con: fecha (cd), distancia (AU, km, LD), v_rel (km/s) y H; explica en lenguaje simple.
Devuelve la orden CAD_CALL en una única línea (sin texto extra) cuando aplique.`
}

function extractCadCall(text: string): { raw: string; args: any } | null {
  const m = text?.match?.(/^\s*CAD_CALL\s+(\{[\s\S]*\})\s*$/m)
  if (!m) return null
  try { return { raw: m[0], args: JSON.parse(m[1]) } } catch { return null }
}

async function callOllama(OLLAMA_URL: string, payload: any) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`OLLAMA_UPSTREAM ${r.status}: ${text}`)
  }
  return r
}

// ——— Helpers para afinar parámetros y compactar datos ———
function lastUserText(messages: Msg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || ''
  }
  return ''
}

function applyUserHints(args: any, user: string) {
  const out = { ...args }
  const want7 = /\b7\b.*d[ií]as|\bsemana\b|pr[oó]xim[oa]s?\s+7/i.test(user)
  const want10LD = /10\s*LD/i.test(user)
  const askClosest = /m[aá]s\s+cercan/i.test(user)

  if (want7) {
    out.date_min = 'now'
    out.date_max = '+7'
  }
  if (want10LD) out.dist_max = '10LD'
  if (askClosest) out.sort = 'dist'

  // límite duro, siempre
  if (!out.limit || Number(out.limit) > MAX_ITEMS) out.limit = MAX_ITEMS
  return out
}

function mapCadRow(r: string[]) {
  // [des, orbit_id, jd, cd, dist, dist_min, dist_max, v_rel, v_inf, t_sigma_f, h]
  const [des, , , cd, dist, , , v_rel, , , h] = r
  const distAu = Number(dist)
  return {
    des,
    cd,
    dist_au: distAu,
    dist_km: +(distAu * AU_KM).toFixed(0),
    dist_ld: +(distAu / LD_AU).toFixed(2),
    v_rel_kms: +Number(v_rel).toFixed(2),
    h: h !== undefined ? +Number(h).toFixed(2) : null
  }
}

function compactCadPayload(cadJson: any, max = MAX_ITEMS) {
  const rows: string[][] = Array.isArray(cadJson?.data) ? cadJson.data : []
  const items = rows.slice(0, max).map(mapCadRow)
  return {
    total: cadJson?.count ?? rows.length,
    returned: items.length,
    items
  }
}

// Puente de streaming (sin dependencia hard a node:stream)
async function proxyStream(event: any, upstream: Response) {
  const ct = upstream.headers.get('Content-Type') || 'application/x-ndjson; charset=utf-8'
  setResponseHeader(event, 'Content-Type', ct)
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const body: any = (upstream as any).body
  if (!body) {
    setResponseStatus(event, 502)
    return { error: 'Upstream has no body' }
  }

  // Intentar Readable.fromWeb si existe (evita cuelgues)
  try {
    const streamMod: any = await import('stream')
    if (typeof body.getReader === 'function' && streamMod?.Readable?.fromWeb) {
      const nodeStream = streamMod.Readable.fromWeb(body)
      return sendStream(event, nodeStream as any)
    }
  } catch { /* fallback */ }

  // Fallback: bombear manualmente el WebReadable al res
  const reader = body.getReader?.()
  if (!reader) return sendStream(event, body as any)
  const res = event.node.res
  res.setHeader('Transfer-Encoding', 'chunked')
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  }
  return pump()
}

export default defineEventHandler(async (event) => {
  try {
    const { OLLAMA_URL } = useRuntimeConfig()
    const body = await readBody<ChatBody>(event)

    const baseMessages = body?.messages || []
    const wantStream = body?.stream ?? true
    const systemToolMsg: Msg = { role: 'system', content: buildToolSystemPrompt() }
    const ollamaBase = OLLAMA_URL || 'http://74.207.237.182:11434'

    // 1) Primer pase: NO streaming → detectar CAD_CALL
    const probePayload = {
      model: body?.model || 'llama3.2',
      messages: [systemToolMsg, ...baseMessages],
      stream: false,
      options: { temperature: 0.2, ...(body?.options || {}) }
    }
    const r1 = await callOllama(ollamaBase, probePayload)
    const j1 = await r1.json()

    // Fase 1 (logs seguros)
    const firstContent: string = (j1 && j1.message && typeof j1.message.content === 'string')
      ? j1.message.content
      : ''
    const cadCall = extractCadCall(firstContent)
    console.log('PHASE1_FIRST_CONTENT:', (firstContent || '').slice(0, 200))
    console.log('CAD_CALL_ARGS:', cadCall?.args ?? null)

    // 2) Si NO hay CAD_CALL → responde normal
    if (!cadCall) {
      if (wantStream) {
        const streamPayload = {
          model: body?.model || 'llama3.2',
          messages: [systemToolMsg, ...baseMessages],
          stream: true,
          options: { temperature: 0.2, ...(body?.options || {}) }
        }
        const upstream = await callOllama(ollamaBase, streamPayload)
        return proxyStream(event, upstream)
      } else {
        setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
        return j1
      }
    }

    // 3) Hay CAD_CALL → aplica hints del usuario para acotar
    const userText = lastUserText(baseMessages)
    const tunedArgs = applyUserHints(cadCall.args || {}, userText)

    // Ejecutar CAD (URL ABSOLUTA; sin 'des' vacío)
    const params = new URLSearchParams({
      date_min: tunedArgs.date_min ?? 'now',
      date_max: tunedArgs.date_max ?? '+60',
      dist_max: tunedArgs.dist_max ?? '0.05',
      body: tunedArgs.body ?? 'Earth',
      sort: tunedArgs.sort ?? 'date'
    })
    if (tunedArgs.des && String(tunedArgs.des).trim() !== '') {
      params.set('des', String(tunedArgs.des).trim())
    }
    for (const k of ['limit','v-rel-min','v-rel-max','h-min','h-max','pha','neo','diameter','fullname']) {
      if (tunedArgs?.[k] !== undefined && String(tunedArgs[k]) !== '') {
        params.set(k, String(tunedArgs[k]))
      }
    }

    const { origin } = getRequestURL(event) // ej: http://localhost:3000
    const toolUrl = new URL(`/api/tools/cad?${params.toString()}`, origin).toString()

    console.log('TOOL_URL:', toolUrl)
    const toolResp = await fetch(toolUrl, { method: 'GET' })
    if (!toolResp.ok) {
      const t = await toolResp.text().catch(() => '')
      console.error('CAD_ERROR', toolResp.status, t)
      setResponseStatus(event, toolResp.status || 502)
      return { error: 'CAD proxy error', detail: t }
    }
    const cadJson = await toolResp.json()

    // Compactar y limitar datos antes de enviarlos al modelo
    const compact = compactCadPayload(cadJson, MAX_ITEMS)
    console.log('CAD_RESULT_COUNT:', compact.returned, 'of', compact.total)

    // 4) Segundo pase: dar datos compactos al modelo
    const messages2: Msg[] = [
      systemToolMsg,
      ...baseMessages,
      { role: 'assistant', content: cadCall.raw },
      { role: 'user', content: `CAD_RESULT ${JSON.stringify(compact)}` }
    ]

    const finalPayload = {
      model: body?.model || 'llama3.2',
      messages: messages2,
      stream: wantStream,
      options: { temperature: 0.2, ...(body?.options || {}) }
    }

    const upstream2 = await callOllama(ollamaBase, finalPayload)
    if (wantStream) return proxyStream(event, upstream2)

    const j2 = await upstream2.json()
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return j2
  } catch (e: any) {
    console.error('OLLAMA_CHAT_ROUTE_ERROR', e)
    setResponseStatus(event, 500)
    return { error: 'Error en chat.post.ts', detail: e?.message || String(e) }
  }
})
