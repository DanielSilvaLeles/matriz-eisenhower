import { defineConfig, devices } from '@playwright/test'

/**
 * 3 fluxos essenciais (docs secao 9): adicionar e mover tarefa (fase 1c),
 * ciclo de sincronizacao contra um script simulado (fase 2) e triagem da
 * caixa de entrada (fase 3, ainda pendente).
 *
 * Roda contra o build de producao (`npm run build` + `npm run preview`),
 * nao o servidor de desenvolvimento - e o que o CI publica de verdade.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] === undefined ? 0 : 2,
  // Um worker so: os testes compartilham a mesma origem (localhost:4173) e,
  // por enquanto, nao isolam o IndexedDB por teste a nivel de storageState -
  // cada teste limpa o proprio banco no inicio (ver e2e/fixtures.ts).
  workers: 1,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',

  use: {
    baseURL: 'http://localhost:4173/matriz-eisenhower/',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/matriz-eisenhower/',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 30_000,
  },
})
