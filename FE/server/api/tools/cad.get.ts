// server/api/tools/cad.get.ts
import type { H3Event, EventHandler } from 'h3'
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'

type CadNormalizedRow = {
  key: string
  des: string            // designación (nombre/ID)
  cd: string             // fecha/hora UTC
  dist_au: number | null
  dist_ld: number | null
  dist_km: number | null
  v_rel_kms: number | null
  H: number | null
}

const AU_KM = 149_597_870.7
const LD_KM = 384_400
const AU_TO_LD = AU_KM / LD_KM // ~389.172

// ---------- FIX: overloads para que cuando pases fallback el retorno sea string ----------
function firstNonEmpty(q: Record<string, any>, keys: string[]): string | undefined
function firstNonEmpty(q: Record<string, any>, keys: string[], fallback: string): string
function firstNonEmpty(q: Record<string, any>, keys: string[], fallback?: string) {
  for (const k of keys) {
    const v = q[k]
    if (v !== undefined && String(v).trim() !== '') return String(v)
  }
  return fallback // puede ser undefined si no se pasó fallback (primer overload)
}
// ---------------------------------------------------------------------------------------

const handler: EventHandler = defineEventHandler(async (event: H3Event) => {
  try {
    const q = getQuery(event) as Record<string, any>
    const normalize = /^(1|true|yes)$/i.test(String(q.normalize ?? ''))

    // Construir query aceptando snake_case y kebab-case
    const params = new URLSearchParams()
    // Como pasamos fallback, el tipo de retorno es `string` (no union), así evitamos el error TS2345
    params.set('date-min', firstNonEmpty(q, ['date-min', 'date_min'], 'now'))
    params.set('date-max', firstNonEmpty(q, ['date-max', 'date_max'], '+60')) // relativo
    params.set('dist-max', firstNonEmpty(q, ['dist-max', 'dist_max'], '0.05')) // AU o "10LD"
    params.set('body',     firstNonEmpty(q, ['body'], 'Earth'))
    params.set('sort',     firstNonEmpty(q, ['sort'], 'date'))
    params.set('neo',      firstNonEmpty(q, ['neo'], 'true')) // por defecto solo NEOs

    // Opcionales: solo si vienen (acepta snake/kebab)
    const maybes = [
      'limit','des','v-rel-min','v_rel_min','v-rel-max','v_rel_max',
      'h-min','h_min','h-max','h_max','pha','diameter','fullname'
    ]
    for (const k of maybes) {
      const v = q[k]
      if (v !== undefined && String(v).trim() !== '') {
        const apiKey = k.replaceAll('_', '-') // normaliza a kebab-case
        params.set(apiKey, String(v))
      }
    }

    const url = `https://ssd-api.jpl.nasa.gov/cad.api?${params.toString()}`
    const r = await fetch(url)

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      setResponseStatus(event, r.status || 502)
      return { error: 'JPL CAD upstream error', status: r.status, body: text }
    }

    // Modo original (compatibilidad con tu chat): devuelve crudo si no piden normalizar
    if (!normalize) {
      return await r.json()
    }

    // Normalizado para la pestaña "Acercamientos (CAD)"
    const up = await r.json()
    const fields: string[] = up?.fields ?? []
    const rows: any[][] = up?.data ?? []

    const idx = (name: string) => fields.indexOf(name)
    const iDes = idx('des')
    const iCd = idx('cd')
    const iDist = idx('dist')
    const iVrel = idx('v_rel')
    const iH = idx('h')

    const data: CadNormalizedRow[] = rows.map((r: any[], i: number) => {
      const distAU = r[iDist] != null ? Number(r[iDist]) : null
      const distLD = distAU != null ? distAU * AU_TO_LD : null
      const distKM = distAU != null ? distAU * AU_KM : null
      const vrel = r[iVrel] != null ? Number(r[iVrel]) : null
      const H = r[iH] != null ? Number(r[iH]) : null
      return {
        key: `${i}-${r[iDes] ?? 'obj'}`,
        des: r[iDes] ?? '—',
        cd: r[iCd] ?? '—',
        dist_au: distAU,
        dist_ld: distLD,
        dist_km: distKM,
        v_rel_kms: vrel,
        H
      }
    })

    return {
      ok: true,
      count: data.length,
      meta: {
        source: 'JPL CNEOS CAD',
        upstream_url: url,
        params: Object.fromEntries(params)
      },
      data
    }
  } catch (e: any) {
    setResponseStatus(event, 500)
    return { error: 'CAD proxy error', detail: e?.message || String(e) }
  }
})

export default handler
