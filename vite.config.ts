import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// O app e publicado em https://<usuario>.github.io/matriz-eisenhower/,
// entao todo caminho absoluto precisa do subcaminho do repositorio.
// Manifest, start_url, scope e service worker (fase 4) seguem este mesmo valor.
//
// Build para dois repositórios sem conflito de dados
// (`docs/prompt-anotacoes.md` seção 1.8): `VITE_BASE_PATH`/`VITE_APP_ID`
// vêm do workflow de deploy (`.github/workflows/deploy.yml`), calculados a
// partir de `github.event.repository.name` - **ausentes** (`undefined`)
// em dev local e em qualquer build que não passe por esse workflow, caso
// em que os valores de PRODUÇÃO abaixo são usados, exatamente como antes
// desta extensão existir. `process.env`, não `import.meta.env`: este
// arquivo roda em Node (configuração do Vite), não no bundle do browser -
// `src/appId.ts` é o módulo equivalente para o código do app em si, que
// não pode ser importado aqui por rodarem em contextos diferentes.
const DEFAULT_BASE_PATH = '/matriz-eisenhower/'
export const BASE_PATH = process.env['VITE_BASE_PATH'] ?? DEFAULT_BASE_PATH
const APP_ID = process.env['VITE_APP_ID'] ?? ''
const IS_BETA = APP_ID !== ''
const APP_NAME = IS_BETA ? 'Matriz (beta)' : 'Matriz de Eisenhower'
const APP_SHORT_NAME = IS_BETA ? 'Matriz beta' : 'Matriz'

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
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
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
        // Dois atalhos de app, com nomes que não se confundem
        // (`docs/prompt-anotacoes.md` seção 3.4 - "ideia" e "anotação" são
        // conceitos diferentes, seção 2): "Nova ideia" abre direto na
        // captura rápida da caixa de entrada (query `?captura=1`, lida em
        // src/pwa/useIncomingIntent.ts, que foca o campo - com o foco, o
        // teclado do celular abre sozinho). "Nova anotação" abre direto no
        // editor de anotação (rota por hash, lida em src/ui/router/ - não
        // precisa de query nem de código novo de intenção, o hash já é a
        // própria rota). O nome do atalho original era "Nova anotação" e
        // na verdade sempre foi a captura de IDEIA - renomeado aqui junto
        // com a extensão, pelo mesmo motivo que a seção 3.4 pede.
        shortcuts: [
          {
            name: 'Nova ideia',
            short_name: 'Nova ideia',
            url: `${BASE_PATH}?captura=1`,
            icons: [{ src: `${BASE_PATH}icons/shortcut-capture.png`, sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Nova anotação',
            short_name: 'Nova anotação',
            url: `${BASE_PATH}#/anotacoes/nova`,
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
        // `cacheId` SÓ no beta (build para dois repositórios,
        // docs/prompt-anotacoes.md seção 1.8) - omitido por completo em
        // produção, para os nomes de cache do service worker continuarem
        // exatamente como antes desta extensão existir. Produção e beta
        // compartilham a mesma origem (github.io), e Cache Storage é
        // isolado por origem, não por caminho - sem isto, os dois
        // Service Workers disputariam os mesmos nomes de cache.
        ...(IS_BETA ? { cacheId: APP_ID } : {}),
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
