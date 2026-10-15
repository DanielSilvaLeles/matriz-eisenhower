import { test as base } from '@playwright/test'

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
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('matriz-eisenhower')
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
    )
    await page.reload()
    await use(page)
  },
})

export { expect } from '@playwright/test'
