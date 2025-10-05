<!-- pages/catalogo.vue -->
<template>
  <section class="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">Catálogo de NEOs (meteoritos)</h1>
      <p class="text-sm text-gray-500">
        Datos en vivo desde NASA NeoWs (asteroides) y JPL CNEOS CAD (acercamientos).
      </p>
    </header>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        class="px-3 py-2 rounded-2xl border"
        :class="source === 'neows' ? 'bg-black text-white' : 'bg-white'"
        @click="source = 'neows'">
        Asteroides (NeoWs)
      </button>
      <button
        class="px-3 py-2 rounded-2xl border"
        :class="source === 'cad' ? 'bg-black text-white' : 'bg-white'"
        @click="source = 'cad'">
        Acercamientos (CAD)
      </button>
    </div>

    <!-- Controles -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <div class="col-span-1">
        <label class="block text-sm font-medium mb-1">Buscar por nombre/designación</label>
        <input v-model="search" type="text" placeholder="Ej: Apophis, 433 Eros"
               class="w-full rounded-xl border px-3 py-2" />
      </div>

      <div v-if="source === 'neows'" class="flex items-end gap-2">
        <button @click="prevPage" class="px-3 py-2 rounded-xl border">⟵</button>
        <span class="text-sm">Página {{ page + 1 }}</span>
        <button @click="nextPage" class="px-3 py-2 rounded-xl border">⟶</button>
      </div>

      <div v-else class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-sm font-medium mb-1">Desde</label>
          <input v-model="dateMin" type="date" class="w-full rounded-xl border px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Hasta</label>
          <input v-model="dateMax" type="date" class="w-full rounded-xl border px-3 py-2" />
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium mb-1">Distancia máx. (AU o “LD”)</label>
          <input v-model="distMax" type="text" placeholder="0.05 o 10LD"
                 class="w-full rounded-xl border px-3 py-2" />
        </div>
        <div class="col-span-2">
          <button @click="loadCad" class="px-3 py-2 rounded-xl border w-full">Actualizar CAD</button>
        </div>
      </div>
    </div>

    <!-- Resultados -->
    <div v-if="source === 'neows'">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <article v-for="a in filteredAsteroids" :key="a.id" class="rounded-2xl border p-4 bg-white shadow-sm">
          <div class="flex items-center gap-3">
            <!-- SOLO CAMBIO: mostrar imagen si existe, sino el cuadro 'NEO' -->
            <img
              v-if="a.image?.thumb"
              :src="a.image.thumb"
              :alt="a.image?.title || a.name"
              class="w-14 h-14 rounded-xl object-cover"
            />
            <div v-else class="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-500">
              NEO
            </div>

            <div>
              <h3 class="font-semibold">
                {{ a.name }}
                <span v-if="a.is_potentially_hazardous_asteroid"
                      class="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">PHA</span>
              </h3>
              <a :href="a.nasa_jpl_url" target="_blank" class="text-xs text-blue-600 underline">Ficha JPL</a>
            </div>
          </div>
          <dl class="text-sm mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <dt class="text-gray-500">H (mag)</dt><dd>{{ a.absolute_magnitude_h }}</dd>
            <dt class="text-gray-500">Diám. (km)</dt>
            <dd>
              {{ formatRangeKm(a.estimated_diameter?.kilometers?.estimated_diameter_min,
                               a.estimated_diameter?.kilometers?.estimated_diameter_max) }}
            </dd>
          </dl>
        </article>
      </div>
      <p v-if="loadingNeo" class="text-sm text-gray-500 mt-3">Cargando NeoWs…</p>
    </div>

    <div v-else>
      <div class="overflow-x-auto rounded-2xl border bg-white">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-3 py-2">Designación</th>
              <th class="text-left px-3 py-2">Fecha (UTC)</th>
              <th class="text-left px-3 py-2">Dist. (LD)</th>
              <th class="text-left px-3 py-2">Vel. rel. (km/s)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredCad" :key="row.key" class="border-t">
              <td class="px-3 py-2">{{ row.des }}</td>
              <td class="px-3 py-2">{{ row.cd }}</td>
              <td class="px-3 py-2">{{ row.dist_ld?.toFixed?.(2) ?? '—' }}</td>
              <td class="px-3 py-2">{{ row.v_rel_kms?.toFixed?.(2) ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="loadingCad" class="text-sm text-gray-500 mt-3">Cargando CAD…</p>
      <p class="text-xs text-gray-500 mt-2">* CAD = Close-Approach Data de JPL CNEOS.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'

/** === Types === */
type NeoAsteroid = {
  id: string
  name: string
  nasa_jpl_url: string
  absolute_magnitude_h: number
  estimated_diameter?: { kilometers?: { estimated_diameter_min?: number, estimated_diameter_max?: number } }
  is_potentially_hazardous_asteroid?: boolean
  // añadimos el campo image (opcional) para la miniatura NASA
  image?: { thumb: string | null, original?: string | null, credit?: string | null, title?: string | null }
}

type CadRow = {
  key: string
  des: string
  cd: string
  dist_ld: number | null
  v_rel_kms: number | null
}

/** === State === */
const source = ref<'neows' | 'cad'>('neows')
const search = ref('')

/** NeoWs state */
const page = ref(0)
const size = ref(20)
const asteroids = ref<NeoAsteroid[]>([])
const loadingNeo = ref(false)

/** CAD state */
const todayISO = new Date().toISOString().slice(0,10)
const in7daysISO = (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10) })()

const dateMin = ref<string>(todayISO)
const dateMax = ref<string>(in7daysISO)
const distMax = ref('10LD') // 10 distancias lunares por defecto
const cadRows = ref<CadRow[]>([])
const loadingCad = ref(false)

/** === Computed === */
const filteredAsteroids = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return asteroids.value
  return asteroids.value.filter(a => a.name?.toLowerCase().includes(q))
})

const filteredCad = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return cadRows.value
  return cadRows.value.filter(r => r.des?.toLowerCase().includes(q))
})

/** === Utils === */
function formatRangeKm(min?: number, max?: number) {
  if (min == null && max == null) return '—'
  const a = (min ?? max ?? 0).toFixed(3)
  const b = (max ?? min ?? 0).toFixed(3)
  return `${a}–${b}`
}

/** Enriquecer NEOs con miniaturas de NASA Image Library */
async function enrichImages(list: NeoAsteroid[]) {
  // limita a los primeros N visibles para no spamear la API
  const slice = list.slice(0, 24)
  const jobs = slice.map(async (a) => {
    try {
      const r = await $fetch<{ ok: boolean, hit: any }>('/api/tools/images.search', { query: { q: a.name } })
      if (r?.hit) a.image = r.hit
    } catch { /* noop */ }
  })
  await Promise.allSettled(jobs)
}

/** === Loads === */
async function loadNeo() {
  loadingNeo.value = true
  try {
    const res = await $fetch<{ ok: boolean; data: NeoAsteroid[]; page: number; size: number }>(
      '/api/tools/neows/browse',
      { query: { page: page.value, size: size.value } }
    )
    asteroids.value = res?.data ?? []
    await enrichImages(asteroids.value)
  } finally {
    loadingNeo.value = false
  }
}

async function loadCad() {
  loadingCad.value = true
  try {
    const res = await $fetch<{ ok: boolean; data: CadRow[] }>(
      '/api/tools/cad',
      {
        query: {
          'date-min': dateMin.value,
          'date-max': dateMax.value,
          'dist-max': distMax.value,
          'neo': 'true',
          'sort': 'date',
          'limit': 100,
          'normalize': 1
        }
      }
    )
    cadRows.value = Array.isArray(res?.data) ? res.data : []
  } finally {
    loadingCad.value = false
  }
}

/** === Paging === */
function nextPage() { page.value++; loadNeo() }
function prevPage() { page.value = Math.max(0, page.value - 1); loadNeo() }

/** === Effects === */
watch(source, (s) => {
  if (s === 'neows' && asteroids.value.length === 0) loadNeo()
  if (s === 'cad' && cadRows.value.length === 0) loadCad()
})

onMounted(() => {
  loadNeo()
})
</script>
