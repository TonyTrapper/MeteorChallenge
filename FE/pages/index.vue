<template>
  <section class="relative isolate min-h-[70vh] flex items-center overflow-hidden">
    <!-- Fondos decorativos -->
    <div class="pointer-events-none absolute inset-0 -z-10">
      <div class="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl"></div>
      <div class="absolute bottom-[-6rem] right-[-6rem] h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent dark:via-white/5" aria-hidden="true"></div>
    </div>

    <div class="w-full px-6 py-20">
      <div class="space-y-7 max-w-3xl mx-auto text-center">
        <!-- Mascota / logo centrado -->
        <img
          src="/images/logoweb.png"
          alt="Mascota saludando del observatorio"
          class="mx-auto h-28 md:h-36 drop-shadow-xl -rotate-3 hover:rotate-0 transition-transform duration-500 will-change-transform"
          loading="eager"
          decoding="async"
        />

        <h1 class="text-4xl md:text-6xl font-semibold leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 dark:from-indigo-400 dark:via-sky-400 dark:to-teal-300">
          Explora el universo de los asteroides
        </h1>

        <p class="text-neutral-600 dark:text-neutral-300/90 text-lg">
          Catálogo, seguimiento y simulaciones para entender trayectorias, tamaños y riesgos.
        </p>

        <div class="flex items-center justify-center gap-3">
          <UButton to="/lanzar" size="lg" class="rounded-full shadow-sm">Lanzar 🚀</UButton>
          <UButton to="/about" variant="outline" size="lg" class="rounded-full">Acerca de</UButton>
        </div>

        <div class="grid gap-6 md:grid-cols-3 pt-10 text-left">
          <UCard class="rounded-2xl border border-neutral-200/50 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-lg shadow-sm">
            <template #header>
              <h3 class="font-medium flex items-center gap-2">📡 Seguimiento</h3>
            </template>
            <p class="text-sm text-neutral-700 dark:text-neutral-300">Observa asteroides cercanos a la Tierra (NEOs) y sus ventanas de paso.</p>
          </UCard>

          <UCard class="rounded-2xl border border-neutral-200/50 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-lg shadow-sm">
            <template #header>
              <h3 class="font-medium flex items-center gap-2">📚 Catálogo</h3>
            </template>
            <p class="text-sm text-neutral-700 dark:text-neutral-300">Consulta propiedades: tamaño, composición y órbitas conocidas.</p>
          </UCard>

          <UCard class="rounded-2xl border border-neutral-200/50 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-lg shadow-sm">
            <template #header>
              <h3 class="font-medium flex items-center gap-2">🧪 Simulaciones</h3>
            </template>
            <p class="text-sm text-neutral-700 dark:text-neutral-300">Ensaya maniobras y escenarios en un entorno seguro.</p>
          </UCard>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
useHead({ title: 'Observatorio de Asteroides — Inicio' })
</script>
