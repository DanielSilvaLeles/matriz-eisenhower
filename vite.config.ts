import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// O app e publicado em https://<usuario>.github.io/matriz-eisenhower/,
// entao todo caminho absoluto precisa do subcaminho do repositorio.
// Manifest, start_url, scope e service worker (fase 4) seguem este mesmo valor.
export const BASE_PATH = '/matriz-eisenhower/'

/**
 * Identificacao do build, para conferir se o Pages publicou a versao nova.
 * O SHA vem do GitHub Actions; local vira "dev".
 */
const buildInfo = {
  sha: (process.env['GITHUB_SHA'] ?? 'dev').slice(0, 7),
  builtAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // O dominio e puro: roda em node, sem DOM. Testes de componente
    // entram com jsdom quando houver componente com logica propria.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
