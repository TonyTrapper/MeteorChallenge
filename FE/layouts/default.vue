<template>
  <div class="min-h-screen bg-background text-foreground">
    <nav class="sticky top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur">
      <div class="container mx-auto flex items-center justify-between py-3">
        <NuxtLink to="/" class="font-semibold flex items-center gap-2">
          <span>🚀</span> <span>Observatorio de Asteroides</span>
        </NuxtLink>
        <ul class="flex gap-6 text-sm">
          <li><NuxtLink to="/" class="hover:text-primary">Inicio</NuxtLink></li>
          <li><NuxtLink to="/lanzar" class="hover:text-primary">Lanzar</NuxtLink></li>
          <li><NuxtLink to="/chat" class="hover:text-primary">Chat</NuxtLink></li>
          <li><NuxtLink to="/catalogo" class="hover:text-primary">Catalogo</NuxtLink></li>          
          <li><NuxtLink to="/about" class="hover:text-primary">About</NuxtLink></li>
          <li><NuxtLink to="/test" class="hover:text-primary">test</NuxtLink></li>
        </ul>
      </div>
    </nav>

    <main class="container mx-auto py-10">
      <slot />
    </main>
  </div>
</template>

<script setup>
defineOptions({ name: "LayoutDefault" })
</script>
