import { test as base } from '@playwright/test'

/**
 * Nome do banco Dexie de verdade - mesma fórmula de `src/appId.ts`
 * (`dbNameFor`), duplicada aqui porque este arquivo roda em Node puro, sem
 * passar pelo transform do Vite (`import.meta.env` não existe aqui - ver
 * `vite.config.ts` para o mesmo tipo de duplicação, pelo mesmo motivo).
 * `VITE_APP_ID` vem do workflow de deploy (build para dois repositórios,
 * docs/prompt-anotacoes.md seção 1.8) - ausente em dev local e no
 * repositório de produção.
 */
const APP_ID = process.env['VITE_APP_ID'] ?? ''
const DB_NAME = APP_ID === '' ? 'matriz-eisenhower' : `${APP_ID}-matriz-eisenhower`

/**
 * Cada teste comeca com o banco local zerado - sem isso, testes anteriores
 * (ou uma execucao anterior na mesma maquina) deixariam tarefas penduradas
 * e os contadores n/10 não bateriam com o que o teste espera.
 *
 * `indexedDB.deleteDatabase` e assincrono (devolve um IDBOpenDBRequest, nao
 * uma Promise) - sem esperar o evento `success`, o reload seguinte podia
 * abrir o banco antes da exclusao terminar de verdade.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/')
    await page.evaluate(
      (dbName) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(dbName)
          request.addEventListener('success', () => {
            resolve()
          })
          request.addEventListener('error', () => {
            reject(new Error('Falha ao apagar o banco de teste.'))
          })
          // Raro, mas se acontecer o reload abaixo ja troca de contexto mesmo assim.
          request.addEventListener('blocked', () => {
            resolve()
          })
        }),
      DB_NAME,
    )
    await page.reload()
    await use(page)
  },
})

export { expect } from '@playwright/test'
