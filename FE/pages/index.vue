<template>
  <section class="min-h-[60vh] grid place-items-center text-center">
    <div class="space-y-6 max-w-3xl mx-auto">
      <h1 class="text-4xl md:text-5xl font-semibold">
        Explora el universo de los asteroides
      </h1>
      <p class="text-neutral-500">
        Catálogo, seguimiento y simulaciones para entender trayectorias, tamaños y riesgos.
      </p>

      <div class="flex items-center justify-center gap-3">
        <UButton to="/lanzar" size="lg">Lanzar 🚀</UButton>
        <UButton to="/about" variant="outline" size="lg">Acerca de</UButton>
      </div>

      <div class="grid gap-6 md:grid-cols-3 pt-8 text-left">
        <UCard class="rounded-2xl">
          <template #header><h3 class="font-medium">Seguimiento</h3></template>
          <p class="text-sm text-neutral-600">Observa asteroides cercanos a la Tierra (NEOs) y sus ventanas de paso.</p>
        </UCard>
        <UCard class="rounded-2xl">
          <template #header><h3 class="font-medium">Catálogo</h3></template>
          <p class="text-sm text-neutral-600">Consulta propiedades: tamaño, composición y órbitas conocidas.</p>
        </UCard>
        <UCard class="rounded-2xl">
          <template #header><h3 class="font-medium">Simulaciones</h3></template>
          <p class="text-sm text-neutral-600">Ensaya maniobras y escenarios en un entorno seguro.</p>
        </UCard>
      </div>
    </div>
  </section>
</template>

<script setup>
useHead({ title: "Observatorio de Asteroides — Inicio" })
</script>
