// server/api/tools/images.search.get.ts
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'

type Hit = {
  title: string | null
  thumb: string | null
  original: string | null
  credit: string | null
  nasa_id: string | null
  page: string | null
}

// (Opcional) overrides locales por nombre exacto
const OVERRIDES: Record<string, Hit> = {
  // "Apophis": { title: "Apophis", thumb: "/img/apophis.jpg", original: "/img/apophis.jpg", credit: "NASA/JPL", nasa_id: null, page: null }
}

// Cache simple en memoria (24h)
const CACHE = new Map<string, { expires: number; payload: any }>()
const TTL_MS = 24 * 60 * 60 * 1000

async function searchOnce(q: string) {
  const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) return null
  return await res.json()
}

async function getAsset(nasaId: string): Promise<{ original?: string } | null> {
  const url = `https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`
  const r = await fetch(url)
  if (!r.ok) return null
  const j = await r.json()
  const hrefs: string[] = j?.collection?.items?.map((x: any) => x?.href).filter(Boolean) || []
  const orig = hrefs.find(h => /orig\./i.test(h)) || hrefs.find(h => /\.(jpg|png)$/i.test(h)) || hrefs[0]
  return { original: orig }
}

function pickBest(items: any[]) {
  const score = (it: any) => {
    const d = it?.data?.[0] || {}
    const title = (d.title || '').toLowerCase()
    const kws: string[] = d?.keywords || []
    let s = 0
    if (kws.some((k: string) => /asteroid|neo|near[- ]earth|small body/i.test(k))) s += 3
    if (/asteroid|neo|near[- ]earth|small body/.test(title)) s += 2
    return s
  }
  return items.slice().sort((a, b) => score(b) - score(a))[0]
}

export default defineEventHandler(async (event) => {
  const { q } = getQuery(event) as { q?: string }
  const query = (q?.trim() || '')
  if (!query) return { ok: true, hit: null }

  // Cache lookup
  const key = query.toLowerCase()
  const now = Date.now()
  const cached = CACHE.get(key)
  if (cached && cached.expires > now) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    return cached.payload
  }

  // Override local
  const override = OVERRIDES[query]
  if (override) {
    const payload = { ok: true, hit: override, source: 'override' }
    CACHE.set(key, { expires: now + TTL_MS, payload })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    return payload
  }

  // Búsqueda progresiva
  let j = await searchOnce(query)
  let items: any[] = j?.collection?.items || []

  if (!items?.length) {
    j = await searchOnce(`asteroid ${query}`)
    items = j?.collection?.items || []
  }
  if (!items?.length) {
    j = await searchOnce('asteroid')
    items = j?.collection?.items || []
  }

  if (!items?.length) {
    const payload = { ok: true, hit: null }
    CACHE.set(key, { expires: now + TTL_MS, payload })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    return payload
  }

  const best = pickBest(items) || items[0]
  const d = best?.data?.[0] || {}
  const L = best?.links?.[0] || {}
  const nasa_id = d?.nasa_id || null

  let original: string | null = null
  if (nasa_id) {
    const asset = await getAsset(nasa_id).catch(() => null)
    original = asset?.original || null
  }

  const hit: Hit = {
    title: d?.title || null,
    thumb: L?.href || null,
    original,
    credit: d?.secondary_creator || d?.center || null,
    nasa_id,
    page: best?.href || null
  }

  const payload = { ok: true, hit, source: 'images-api.nasa.gov' }
  CACHE.set(key, { expires: now + TTL_MS, payload })
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return payload
})
