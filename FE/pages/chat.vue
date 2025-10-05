<template>
  <section class="max-w-3xl mx-auto space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold">Chat</h1>
      <div class="flex items-center gap-2">
        <label class="text-sm text-neutral-500">Modelo</label>
        <select v-model="model" class="px-2 py-1 border rounded-lg bg-white/5">
          <option value="llama3.2">llama3.2</option>
        </select>
      </div>
    </div>

    <div ref="scrollEl" class="border rounded-2xl p-4 h-[60vh] overflow-auto bg-neutral-950/30">
      <div v-for="(m, i) in visibleMessages" :key="i" class="mb-3">
        <div :class="m.role === 'user' ? 'text-right' : 'text-left'">
          <div
            class="inline-block px-3 py-2 rounded-2xl whitespace-pre-wrap break-words leading-relaxed"
            :class="m.role === 'user' ? 'bg-primary/10' : 'bg-white/5'"
          >
            {{ m.content }}
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-neutral-500">Escribiendo…</div>
      <div v-if="errorMsg" class="mt-2 text-sm text-red-400">{{ errorMsg }}</div>
    </div>

    <form @submit.prevent="onSend" class="flex items-start gap-2">
      <textarea
        v-model="input"
        @keydown.enter.exact.prevent="onSend"
        @keydown.enter.shift.exact.stop
        placeholder="Escribe tu mensaje (Enter para enviar, Shift+Enter para salto de línea)"
        class="flex-1 px-3 py-2 border rounded-xl min-h-[52px] max-h-40 overflow-auto"
      />
      <div class="flex gap-2">
        <button
          type="submit"
          :disabled="loading || !input.trim()"
          class="px-4 py-2 rounded-xl bg-primary text-white disabled:opacity-50"
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

type Role = 'system' | 'user' | 'assistant'
type Msg = { role: Role; content: string }

const model = ref('llama3.2') // por defecto usamos llama3.2
const systemPrompt = ref('Eres un asistente conciso y útil.')
const messages = ref<Msg[]>([{ role: 'system', content: systemPrompt.value }])
const input = ref('')
const loading = ref(false)
const errorMsg = ref('')
const scrollEl = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

const visibleMessages = computed(() => messages.value.filter(m => m.role !== 'system'))

watch(messages, async () => {
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
}, { deep: true })

function onClear () {
  messages.value = [{ role: 'system', content: systemPrompt.value }]
  errorMsg.value = ''
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
        model: model.value,       // si lo omites, el endpoint usa llama3.2 por defecto
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
          if (data?.message?.content) {
            currentAssistant.content += data.message.content
          }
        } catch {
          // línea parcial; la procesamos en el siguiente ciclo
        }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') currentAssistant.content += '\n\n[Detenido por el usuario]'
    else errorMsg.value = 'Error al hablar con el backend.'
  } finally {
    loading.value = false
    abortController = null
  }
}

function onStop () {
  abortController?.abort()
}
</script>
