// nuxt.config.ts
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detecta si estás en dev
const isDev = process.env.NODE_ENV !== "production";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  // 🚫 Desactiva DevTools fuera de dev (evita el socket nuxt-dev-*.sock)
  devtools: { enabled: isDev && process.env.NUXT_DEVTOOLS !== "disabled" },

  modules: [
    "@nuxt/ui",
    "@nuxt/scripts",
    "@nuxt/image",
    "@nuxt/eslint",
    "@nuxt/content",
    // ❌ No cargues test-utils en server normal (solo en tests)
    // isDev ? "@nuxt/test-utils" : undefined,
  ].filter(Boolean) as any,

  // CSS principal
  css: [resolve(__dirname, "assets/css/main.css")],

  // Tailwind v4 (Vite plugin)
  vite: {
    plugins: [tailwindcss()],
  },

  eslint: {
    config: {
      stylistic: {
        semi: true,
        quotes: "double",
        indent: "tab",
        commaDangle: "always-multiline",
      },
    },
  },

  // 🔧 Runtime config para el proxy a Ollama
  runtimeConfig: {
    OLLAMA_URL: process.env.OLLAMA_URL || "http://74.207.237.182:11434",
    nasaApiKey: process.env.NASA_API_KEY || 'DEMO_KEY'
  },

  // ✅ Tipos de Node para evitar errores TS en server
  typescript: {
    tsConfig: {
      compilerOptions: {
        types: ["node"],
      },
    },
  },

  // (Opcional) si tu proyecto realmente vive aquí
  rootDir: __dirname,
  srcDir: __dirname,
});
