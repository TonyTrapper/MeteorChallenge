<template>
  <section class="max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_320px] gap-6 p-2 lg:p-0">
    <!-- Columna principal: Chat -->
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 grid place-items-center shadow-sm">
            <span class="text-xl">💬</span>
          </div>
          <div>
            <h1 class="text-3xl font-semibold tracking-tight">Chat</h1>
            <p class="text-xs text-neutral-500">Motor: llama3.2 · IA conversacional</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-neutral-500">Modelo</label>
          <select v-model="model" class="px-2 py-1 border rounded-lg bg-white/5">
            <option value="llama3.2">llama3.2</option>
          </select>
        </div>
      </div>

      <!-- Ventana de chat -->
      <div class="relative border rounded-2xl p-4 h-[60vh] overflow-auto bg-neutral-950/30 backdrop-blur-sm" ref="scrollEl">
        <!-- Fondo/intro hasta que el usuario escriba -->
        <div
          v-if="!hasUserStarted"
          class="absolute inset-0 grid place-items-center p-6 text-center bg-gradient-to-b from-neutral-900/60 via-neutral-900/30 to-transparent pointer-events-none"
        >
          <div class="max-w-2xl mx-auto pointer-events-auto">
            <div class="rounded-3xl border bg-white/5 p-6 backdrop-blur-md shadow-xl">
              <h2 class="text-2xl font-semibold mb-2">¡Hola! 👋</h2>
              <p class="text-sm text-neutral-300 leading-relaxed">
                Bienvenido al chat con <strong>llama3.2</strong>. Este asistente puede apoyarse en datos públicos de la
                NASA sobre <strong>NEO</strong> (Near-Earth Objects) y en el <strong>CAD</strong> (Close Approach Data) para
                responder preguntas de forma didáctica. 💫
              </p>
              <div class="mt-4 grid sm:grid-cols-2 gap-2">
                <button class="px-3 py-2 rounded-xl bg-primary/90 text-white hover:brightness-110" @click="useSuggestion('¿Qué es un NEO? Explícamelo con ejemplos.')">¿Qué es un NEO?</button>
                <button class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20" @click="useSuggestion('Muéstrame 3 acercamientos cercanos (CAD) de los próximos días.')">Ver CAD próximos</button>
                <button class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20" @click="useSuggestion('¿Cuántos NEO se han detectado hoy?')">NEO de hoy</button>
                <button class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20" @click="useSuggestion('Explícame la diferencia entre asteroide, meteoro y meteorito.')">Asteroide vs. meteorito</button>
              </div>
              <p class="mt-4 text-xs text-neutral-400">
                Al enviar tu primer mensaje, esta tarjeta se ocultará automáticamente.
              </p>
            </div>
          </div>

          <!-- Decoración de "meteoritos" -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <span v-for="n in 12" :key="n" class="meteor" :style="meteorStyle(n)"></span>
          </div>
        </div>

        <!-- Mensajes -->
        <div v-for="(m, i) in visibleMessages" :key="i" class="mb-3">
          <div :class="m.role === 'user' ? 'text-right' : 'text-left'">
            <div
              class="inline-block px-3 py-2 rounded-2xl whitespace-pre-wrap break-words leading-relaxed shadow-sm"
              :class="m.role === 'user' ? 'bg-primary/10 border border-primary/30' : 'bg-white/5 border border-white/10'"
            >
              {{ m.content }}
            </div>
          </div>
        </div>

        <div v-if="loading" class="text-sm text-neutral-500">Escribiendo…</div>
        <div v-if="errorMsg" class="mt-2 text-sm text-red-400">{{ errorMsg }}</div>
      </div>

      <!-- Entrada -->
      <form @submit.prevent="onSend" class="flex items-start gap-2 mt-3">
        <textarea
          v-model="input"
          @keydown.enter.exact.prevent="onSend"
          @keydown.enter.shift.exact.stop
          placeholder="Escribe tu mensaje (Enter para enviar, Shift+Enter para salto de línea)"
          class="flex-1 px-3 py-2 border rounded-xl min-h-[52px] max-h-40 overflow-auto bg-white/5"
        />
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="loading || !input.trim()"
            class="px-4 py-2 rounded-xl bg-primary text-white disabled:opacity-50 shadow-sm"
          >
            Enviar
          </button>
          <button
            type="button"
            @click="onStop"
            :disabled="!loading"
            class="px-4 py-2 rounded-xl border disabled:opacity-50"
            title="Detener respuesta"
          >
            Detener
          </button>
          <button
            type="button"
            @click="onClear"
            :disabled="loading || messages.length <= 1"
            class="px-4 py-2 rounded-xl border disabled:opacity-50"
            title="Limpiar conversación"
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>

    <!-- Sidebar derecha: didáctica + imágenes + créditos -->
    <aside class="mt-6 lg:mt-0 space-y-4">
      <!-- Resumen didáctico -->
      <div class="rounded-2xl border bg-white/5 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Resumen didáctico</h3>
          <span class="text-xl">🪨</span>
        </div>
        <div class="mt-3 space-y-3 text-sm leading-relaxed">
          <details open class="group">
            <summary class="cursor-pointer select-none font-medium">¿Qué es un NEO?</summary>
            <ul class="mt-2 list-disc pl-5 text-neutral-300">
              <li><strong>NEO</strong> = Objeto cercano a la Tierra (asteroide o cometa) cuya órbita se acerca a menos de <em>1.3 UA</em> del Sol.</li>
              <li>Pueden hacer <em>acercamientos cercanos</em> a la Tierra; se monitorizan continuamente.</li>
            </ul>
          </details>
          <details class="group">
            <summary class="cursor-pointer select-none font-medium">¿Qué es el CAD?</summary>
            <ul class="mt-2 list-disc pl-5 text-neutral-300">
              <li><strong>CAD</strong> = <em>Close Approach Data</em>, listado de aproximaciones cercanas de NEOs a cuerpos como la Tierra.</li>
              <li>Incluye fecha/hora, distancia mínima, velocidad y designación del objeto.</li>
            </ul>
          </details>
          <div v-if="neoStats" class="rounded-xl border border-white/10 p-3 bg-black/20">
            <p class="text-xs uppercase tracking-wide text-neutral-400">Hoy</p>
            <p class="text-sm">NEOs registrados: <strong>{{ neoStats.todayCount }}</strong></p>
            <p class="text-xs text-neutral-400">Fuente: NeoWs (api.nasa.gov)</p>
          </div>
          <p v-if="cadNote" class="text-xs text-amber-400">{{ cadNote }}</p>
        </div>
      </div>

      <!-- Imágenes de "meteoritos/asteroides" de la NASA -->
      <div class="rounded-2xl border bg-white/5 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Imágenes NASA</h3>
          <span class="text-xl">🌠</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <a
            v-for="img in images"
            :key="img.href"
            :href="img.href"
            target="_blank"
            class="block overflow-hidden rounded-xl border border-white/10 hover:brightness-110"
            :title="img.title"
          >
            <img :src="img.thumb" :alt="img.title" class="w-full h-24 object-cover" />
          </a>
        </div>
        <p class="mt-2 text-[11px] text-neutral-400">Las miniaturas abren el recurso original en images.nasa.gov.</p>
      </div>

      <!-- Créditos y fuentes -->
      <div class="rounded-2xl border bg-white/5 p-4 text-xs leading-relaxed text-neutral-300">
        <h3 class="font-semibold mb-2">Créditos y fuentes</h3>
        <ul class="list-disc pl-5 space-y-1">
          <li>Datos de NEO/CAD: <a href="https://cneos.jpl.nasa.gov/" target="_blank" class="underline">CNEOS (JPL/Caltech)</a>.</li>
          <li>API CAD: <a href="https://ssd-api.jpl.nasa.gov/doc/cad.html" target="_blank" class="underline">SBDB Close-Approach Data</a>.</li>
          <li>API NEO: <a href="https://api.nasa.gov/" target="_blank" class="underline">NeoWs (api.nasa.gov)</a>.</li>
          <li>Imágenes: <a href="https://images.nasa.gov/" target="_blank" class="underline">NASA Image & Video Library</a>.</li>
        </ul>
        <p class="mt-2 italic">Crédito recomendado: “Courtesy NASA/JPL-Caltech”. No implica aval ni patrocinio.</p>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'

type Role = 'system' | 'user' | 'assistant'
type Msg = { role: Role; content: string }

defineOptions({ name: 'Chat' })

const model = ref('llama3.2') // mantener el nombre del modelo
const systemPrompt = ref('Eres un asistente conciso y útil.')
const messages = ref<Msg[]>([{ role: 'system', content: systemPrompt.value }])
const input = ref('')
const loading = ref(false)
const errorMsg = ref('')
const scrollEl = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

// INTRO: no mostrar mensajes del sistema y saber si el usuario ya inició
const visibleMessages = computed(() => messages.value.filter(m => m.role !== 'system'))
const hasUserStarted = computed(() => visibleMessages.value.length > 0)

watch(messages, async () => {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}, { deep: true })

function onClear () {
  messages.value = [{ role: 'system', content: systemPrompt.value }]
  errorMsg.value = ''
}

function useSuggestion (text: string) {
  input.value = text
  // opcional: enviar directo
  // onSend()
}

async function onSend () {
  const text = input.value.trim()
  if (!text || loading.value) return

  errorMsg.value = ''
  messages.value.push({ role: 'user', content: text })

  // Mensaje del assistant que iremos rellenando con el stream
  const currentAssistant: Msg = { role: 'assistant', content: '' }
  messages.value.push(currentAssistant)

  input.value = ''
  loading.value = true
  abortController = new AbortController()

  try {
    const res = await fetch('/api/ollama/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        model: model.value,       // backend usa llama3.2 por defecto si lo omites
        messages: messages.value, // incluimos también el 'system'
        stream: true,
        options: { temperature: 0.2 }
      })
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const data = JSON.parse(trimmed)
          // Ollama chat stream: { message: { role, content }, done: boolean }
          if (data?.message?.content) currentAssistant.content += data.message.content
        } catch {
          // línea parcial; la procesamos en el siguiente ciclo
        }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'assistant') last.content += '\n\n[Detenido por el usuario]'
    } else {
      errorMsg.value = 'Error al hablar con el backend.'
    }
  } finally {
    loading.value = false
    abortController = null
  }
}

function onStop () {
  abortController?.abort()
}

// === Sidebar data (NEO/CAD + imágenes) ===
const NASA_KEY = (import.meta as any).env?.VITE_NASA_KEY || 'DEMO_KEY'
const neoStats = ref<{ todayCount: number } | null>(null)
const cadNote = ref('')
const images = ref<{ title: string; thumb: string; href: string }[]>([])

function formatDateYYYYMMDD (d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function fetchNeoStats () {
  try {
    // NeoWs: feed de hoy (requiere api_key; DEMO_KEY funciona con límites)
    const url = `https://api.nasa.gov/neo/rest/v1/feed/today?detailed=false&api_key=${NASA_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('NeoWs error')
    const data = await res.json()
    const today = Object.keys(data.near_earth_objects || {})[0]
    const count = today ? (data.near_earth_objects[today]?.length || 0) : 0
    neoStats.value = { todayCount: count }
  } catch (e) {
    // Silencioso; solo no mostramos stats
  }
}

async function tryFetchCADSample () {
  try {
    // NOTA IMPORTANTE: el servicio CNEOS/SSD suele bloquear CORS para frontends públicos.
    // Este intento puede fallar en navegador. Lo dejamos como demostración y
    // recomendamos enrutar por backend (por ejemplo, /api/proxy/cad).
    const params = new URLSearchParams({ 'dist-max': '0.05', 'date-min': 'now', 'date-max': '+60', sort: 'date', body: 'Earth', limit: '5' })
    const res = await fetch(`https://ssd-api.jpl.nasa.gov/cad.api?${params.toString()}`)
    if (!res.ok) throw new Error('CAD error')
    await res.json() // si funciona, no hacemos nada extra, solo confirmamos conectividad
    cadNote.value = 'CAD cargado correctamente.'
  } catch (e) {
    cadNote.value = ''
  }
}

async function fetchNasaImages () {
  try {
    const res = await fetch('https://images-api.nasa.gov/search?q=asteroid%20meteorite&media_type=image&page=1')
    if (!res.ok) throw new Error('images error')
    const data = await res.json()
    const items = (data?.collection?.items || []).slice(0, 8)
    images.value = items.map((it: any) => ({
      title: it?.data?.[0]?.title || 'NASA Image',
      thumb: it?.links?.[0]?.href || '',
      href: it?.href || it?.links?.[0]?.href || '#'
    })).filter((x: any) => x.thumb)
  } catch (e) {
    // sin imágenes
  }
}

onMounted(() => {
  fetchNeoStats()
  tryFetchCADSample()
  fetchNasaImages()
})

// Estilos para los "meteoritos" decorativos
function meteorStyle (n: number) {
  const delay = (n * 0.6) + 's'
  const top = (Math.random() * 100) + '%'
  const left = (-20 - Math.random() * 40) + 'px'
  const scale = (0.6 + Math.random() * 0.8).toFixed(2)
  return {
    top, left, animationDelay: delay, transform: `scale(${scale})`
  } as any
}
</script>

<style scoped>
/* Meteoritos: pequeñas líneas diagonales que cruzan el fondo */
@keyframes fall-diagonal {
  0% { transform: translate3d(0,0,0) rotate(25deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translate3d(140vw, 120vh, 0) rotate(25deg); opacity: 0; }
}
.meteor {
  position: absolute;
  width: 140px;
  height: 2px;
  background: linear-gradient(to right, rgba(255,255,255,0.0), rgba(255,255,255,0.8), rgba(255,255,255,0.0));
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.6));
  animation: fall-diagonal 10s linear infinite;
}
</style>
