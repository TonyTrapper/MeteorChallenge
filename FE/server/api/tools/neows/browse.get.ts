// server/api/tools/neows/browse.get.ts
import type { H3Event, EventHandler } from 'h3'
import { defineEventHandler, getQuery } from 'h3'
import { useRuntimeConfig } from '#imports'

type NeoWsBrowseResponse = {
  near_earth_objects?: any[]
  page?: any
  links?: any
}

const handler: EventHandler = defineEventHandler(async (event: H3Event) => {
  const { nasaApiKey } = useRuntimeConfig(event)
  const q = getQuery(event)
  const page = Number(q.page ?? 0)
  const size = Number(q.size ?? 20)

  const url =
    `https://api.nasa.gov/neo/rest/v1/neo/browse` +
    `?page=${page}&size=${size}&api_key=${nasaApiKey || 'DEMO_KEY'}`

  const res = await $fetch<NeoWsBrowseResponse>(url)

  return {
    ok: true,
    page,
    size,
    source: 'NASA NeoWs',
    data: res?.near_earth_objects ?? []
  }
})

export default handler
