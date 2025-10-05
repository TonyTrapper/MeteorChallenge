<template>
  <section class="relative">
    <div class="h-[78vh] w-full rounded-2xl overflow-hidden">
      <ClientOnly fallback-tag="div" fallback="Cargando mapa…">
        <div ref="mapEl" class="h-full w-full"></div>
      </ClientOnly>
    </div>

    <div
      class="pointer-events-auto absolute top-6 left-6 z-50 w-[min(92vw,360px)]"
    >
      <UCard class="rounded-2xl backdrop-blur bg-background/70 ring-1 ring-white/10">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">Simulador de impacto ☄️</h1>
            <span class="text-xs text-neutral-500">Demo</span>
          </div>
        </template>

        <div class="space-y-5">
          <div>
            <label class="text-sm text-neutral-500">Masa del meteorito (t)</label>
            <input type="range" min="1" max="5000" step="10" v-model.number="masaT"
              class="w-full accent-current" />
            <div class="text-xs text-neutral-500 mt-1">{{ masaT.toLocaleString() }} t</div>
          </div>

          <div>
            <label class="text-sm text-neutral-500">Velocidad de entrada (km/s)</label>
            <input type="range" min="5" max="72" step="1" v-model.number="velKmS"
              class="w-full accent-current" />
            <div class="text-xs text-neutral-500 mt-1">{{ velKmS }} km/s</div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="rounded-xl ring-1 ring-white/10 p-3">
              <p class="text-[11px] text-neutral-500">Energía (J)</p>
              <p class="text-sm font-medium truncate" :title="energiaJ.toLocaleString()">
                {{ abreviar(energiaJ) }}
              </p>
            </div>
            <div class="rounded-xl ring-1 ring-white/10 p-3">
              <p class="text-[11px] text-neutral-500">Equiv. (kt)</p>
              <p class="text-sm font-medium">{{ kt.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</p>
            </div>
            <div class="rounded-xl ring-1 ring-white/10 p-3">
              <p class="text-[11px] text-neutral-500">Equiv. (Mt)</p>
              <p class="text-sm font-medium">{{ mt.toLocaleString(undefined, { maximumFractionDigits: 3 }) }}</p>
            </div>
          </div>

          <div class="rounded-xl ring-1 ring-white/10 p-3">
            <p class="text-xs text-neutral-500">Destino</p>
            <p class="text-sm font-medium">
              <span v-if="destino">lng {{ destino[0].toFixed(3) }}, lat {{ destino[1].toFixed(3) }}</span>
              <span v-else class="text-neutral-500">Haz click en el mapa</span>
            </p>
          </div>

          <div class="rounded-xl ring-1 ring-white/10 p-3">
            <p class="text-xs text-neutral-500">Estado</p>
            <p class="text-lg font-medium">
              <span v-if="estado === 'listo'">Listo</span>
              <span v-else-if="estado === 'conteo'">Conteo: {{ cuenta }}</span>
              <span v-else">Impacto ✅</span>
            </p>
          </div>

          <div class="flex gap-2">
            <UButton variant="outline" :disabled="estado==='conteo'" @click="resetear">Reset</UButton>
            <UButton :disabled="!destino || estado!=='listo'" @click="iniciar">Iniciar conteo</UButton>
          </div>

          <p class="text-[11px] text-neutral-500">
            * Modelo simplificado: E = ½·m·v². 1 kilotón TNT ≈ 4.184×10¹² J.
          </p>
        </div>
      </UCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

useHead({ title: 'Lanzar — Simulación de impacto' })

type Estado = 'listo' | 'conteo' | 'impacto'

const estado = ref<Estado>('listo')
const cuenta = ref(5)

const masaT   = ref(500) // toneladas (t)
const velKmS  = ref(20)  // km/s

// Conversiones y energía
const masaKg  = computed(() => masaT.value * 1000)          // t → kg
const velMS   = computed(() => velKmS.value * 1000)         // km/s → m/s
const energiaJ = computed(() => 0.5 * masaKg.value * (velMS.value ** 2))
const kt      = computed(() => energiaJ.value / 4.184e12)   // kilotones
const mt      = computed(() => kt.value / 1000)             // megatones

const abreviar = (n: number) => {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + ' P'
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T'
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' G'
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + ' M'
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + ' k'
  return Math.round(n).toString()
}

const mapEl = ref<HTMLDivElement | null>(null)
let map: any = null
let impactMarker: any = null
let entryMarker: any = null

const destino = ref<[number, number] | null>(null)

// Origen: “punto de entrada” alto sobre el destino (lo calculamos cuando haya destino)
const entrada = ref<[number, number] | null>(null)

// IDs de fuentes/capas para línea de trayectoria
const SRC_LINEA = 'trayecto-src'
const LYR_LINEA = 'trayecto-lyr'

let intervalo: ReturnType<typeof setInterval> | null = null

const iniciar = () => {
  if (!map || !destino.value || estado.value !== 'listo') return
  estado.value = 'conteo'
  cuenta.value = 5
  intervalo = setInterval(() => {
    cuenta.value--
    if (cuenta.value <= 0) {
      if (intervalo) clearInterval(intervalo)
      intervalo = null
      estado.value = 'impacto'
      animarEntrada()
    }
  }, 1000)
}

const resetear = () => {
  if (intervalo) clearInterval(intervalo)
  intervalo = null
  estado.value = 'listo'
  cuenta.value = 5
  // restaurar línea a un segmento nulo
  if (map?.getSource(SRC_LINEA)) {
    ;(map.getSource(SRC_LINEA) as any).setData(lineaGeoJSON(destino.value || [0,0], destino.value || [0,0]))
  }
  if (entryMarker) entryMarker.remove()
}

const lineaGeoJSON = (a: [number, number], b: [number, number]) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [a, b] }
  }]
})

onMounted(async () => {
  const maplibregl = (await import('maplibre-gl')).default
  const { public: pub } = useRuntimeConfig()

  // Estilo: MapTiler hybrid si hay key; si no, fallback Esri raster (realista)
  const styleUrl = pub?.MAPTILER_KEY
    ? `https://api.maptiler.com/maps/hybrid/style.json?key=${pub.MAPTILER_KEY}`
    : null

  const fallbackRasterStyle = {
    version: 8,
    sources: {
      world: {
        type: 'raster',
        tiles: [
          // World Imagery (uso de ejemplo)
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      }
    },
    layers: [{ id: 'world', type: 'raster', source: 'world' }]
  }

  map = new maplibregl.Map({
    container: mapEl.value!,
    style: styleUrl || (fallbackRasterStyle as any),
    center: [0, 20],
    zoom: 2.5,
    minZoom: 2,
    maxZoom: 9, // no te deja acercar hasta ver personas
    hash: false
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('load', () => {
    // fuente + capa para línea de entrada
    map.addSource(SRC_LINEA, { type: 'geojson', data: lineaGeoJSON([0,0], [0,0]) })
    map.addLayer({
      id: LYR_LINEA,
      type: 'line',
      source: SRC_LINEA,
      paint: {
        'line-color': '#60a5fa',
        'line-width': 3,
        'line-dasharray': [2, 2]
      }
    })
  })

  // click para seleccionar destino
  map.on('click', (e: any) => {
    destino.value = [e.lngLat.lng, e.lngLat.lat]

    // calcular punto de “entrada” como offset hacia el noroeste (simula venir del espacio)
    entrada.value = [destino.value[0] - 15, Math.min(85, destino.value[1] + 15)]

    // marcador de impacto
    if (!impactMarker) {
      const elImpact = document.createElement('div')
      elImpact.className = 'rounded-full grid place-items-center text-xl'
      elImpact.textContent = '🎯'
      impactMarker = new maplibregl.Marker({ element: elImpact })
    }
    impactMarker.setLngLat(destino.value).addTo(map)

    // marcador de entrada
    if (!entryMarker) {
      const elEntry = document.createElement('div')
      elEntry.className = 'rounded-full grid place-items-center text-xl'
      elEntry.textContent = '☄️'
      entryMarker = new maplibregl.Marker({ element: elEntry })
    }
    entryMarker.setLngLat(entrada.value!).addTo(map)

    // actualizar línea completa
    if (map.getSource(SRC_LINEA)) {
      ;(map.getSource(SRC_LINEA) as any).setData(lineaGeoJSON(entrada.value!, destino.value))
    }
  })
})

const animarEntrada = () => {
  if (!map || !destino.value || !entrada.value || !entryMarker) return

  const [ax, ay] = entrada.value
  const [bx, by] = destino.value

  // duración basada en velocidad (más rápido, menos ms)
  const durMs = Math.max(1500, 12000 - (velKmS.value * 120)) // 5–72 km/s
  const t0 = performance.now()

  const step = (tNow: number) => {
    const t = Math.min(1, (tNow - t0) / durMs)
    const lng = ax + (bx - ax) * t
    const lat = ay + (by - ay) * t
    entryMarker.setLngLat([lng, lat])

    // actualizar tramo restante
    if (map?.getSource(SRC_LINEA)) {
      ;(map.getSource(SRC_LINEA) as any).setData(lineaGeoJSON([lng, lat], destino.value!))
    }
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

onBeforeUnmount(() => {
  if (intervalo) clearInterval(intervalo)
  try { map?.remove?.() } catch {}
})
</script>
