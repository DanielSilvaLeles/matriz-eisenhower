import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', nao 'autoUpdate': o documento (secao 8) pede para AVISAR
      // "Nova versão disponível" em vez de recarregar sozinho no meio de
      // uma edição. Com 'prompt' o novo service worker fica esperando ate
      // src/pwa/useServiceWorkerUpdate.ts chamar updateSW() a pedido da
      // pessoa (botão no SyncIndicator-adjacent banner).
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: BASE_PATH,
        name: 'Matriz de Eisenhower',
        short_name: 'Matriz',
        description: 'App pessoal de priorização com a Matriz de Eisenhower.',
        lang: 'pt-BR',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#f6f7f9',
        icons: [
          { src: `${BASE_PATH}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE_PATH}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${BASE_PATH}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // "Nova anotação" (docs secao 8): abre direto na captura. A query
        // `?captura=1` e lida em src/pwa/useIncomingIntent.ts, que foca o
        // campo (e com o foco, o teclado do celular abre sozinho).
        shortcuts: [
          {
            name: 'Nova anotação',
            short_name: 'Nova anotação',
            url: `${BASE_PATH}?captura=1`,
            icons: [{ src: `${BASE_PATH}icons/shortcut-capture.png`, sizes: '192x192', type: 'image/png' }],
          },
        ],
        // Share target por GET (docs secao 8): funciona em hospedagem
        // estática, sem servidor - o navegador so adiciona os campos como
        // query string na própria `action`. Os três params (title/text/url)
        // chegam juntos em src/pwa/useIncomingIntent.ts, que monta um texto
        // só e chama captureItem (a mesma porta única de qualquer captura).
        share_target: {
          action: BASE_PATH,
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        // SPA de uma rota só: qualquer navegação cai no mesmo index.html
        // (com o subcaminho do Pages explícito, pela mesma razão do manifest).
        navigateFallback: `${BASE_PATH}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
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
