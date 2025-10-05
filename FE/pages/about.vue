<template>
  <section class="container mx-auto py-10">
    <UCard class="max-w-2xl">
      <template #header>
        <h1 class="text-2xl font-semibold">About</h1>
      </template>

      <p class="text-sm text-neutral-600">
        Esta es la página About, hecha con Nuxt + Tailwind v4 + Nuxt UI.
      </p>

      <template #footer>
        <UButton to="/" variant="outline">Volver al inicio</UButton>
      </template>
    </UCard>
  </section>
</template>

<script setup>
useHead({ title: "About — Acme Corp" })
</script>
