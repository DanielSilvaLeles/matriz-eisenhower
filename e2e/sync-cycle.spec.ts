import type { Route } from '@playwright/test'
import { computeChecksum } from '@/domain/checksum.ts'
import { syncDataSchema, syncRequestSchema, type SyncData } from '@/domain/syncProtocol.ts'
import { expect, test } from './fixtures.ts'

/**
 * Fluxo essencial 3 (docs secao 9): ciclo de sincronizacao contra um script
 * simulado. `page.route()` intercepta as chamadas para
 * `https://script.google.com/**` ANTES de saírem do navegador - nenhuma
 * URL ou token real entra no repositorio, e o Google nunca e contactado de
 * verdade.
 *
 * O servidor falso mora no processo do TESTE (Node), nao no navegador: o
 * handler de `page.route` roda aqui. Reusa o `computeChecksum` DE VERDADE
 * (src/domain/checksum.ts) em vez de reimplementar a canonicalizacao - a
 * licao de src/sync/engine.test.ts: um checksum reimplementado que diverge,
 * mesmo num detalhe minimo, nunca bate com o do app e esconde o bug certo
 * atras de uma falha de "resposta inesperada".
 */

const FAKE_URL = 'https://script.google.com/macros/s/teste-e2e/exec'
const TOKEN = 'token-de-teste-com-pelo-menos-32-caracteres'

function createFakeServer() {
  let revision = 0
  let data: SyncData = { schemaVersion: 1, tasks: [], task_events: [], people: [] }

  async function handleRoute(route: Route): Promise<void> {
    const parsedBody = syncRequestSchema.safeParse(JSON.parse(route.request().postData() ?? '{}'))
    if (!parsedBody.success) {
      await route.fulfill({ json: { ok: false, error: 'invalid' } })
      return
    }
    const body = parsedBody.data

    if (body.token !== TOKEN) {
      await route.fulfill({ json: { ok: false, error: 'unauthorized' } })
      return
    }

    if (body.action === 'ping' || body.action === 'pull') {
      const checksum = await computeChecksum({
        tasks: data.tasks,
        taskEvents: data.task_events,
        people: data.people,
      })
      await route.fulfill({ json: { ok: true, revision, checksum, data } })
      return
    }

    // So resta 'push': o if acima ja tratou e saiu de 'ping' e 'pull'.
    const parsedData = syncDataSchema.safeParse(body.data)
    if (parsedData.success) {
      if (body.baseRevision !== revision) {
        await route.fulfill({ json: { ok: false, error: 'conflict' } })
        return
      }
      data = parsedData.data
      revision += 1
      const checksum = await computeChecksum({
        tasks: data.tasks,
        taskEvents: data.task_events,
        people: data.people,
      })
      await route.fulfill({ json: { ok: true, revision, checksum, data } })
      return
    }

    await route.fulfill({ json: { ok: false, error: 'invalid' } })
  }

  return { handleRoute, revisionNow: () => revision }
}

test('configura, sincroniza e confirma - teclado e botao', async ({ page }) => {
  const main = page.locator('main')
  const server = createFakeServer()
  await page.route('https://script.google.com/**', (route) => server.handleRoute(route))

  // Configura URL e token pela tela de Configurações.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByLabel('URL do Apps Script').fill(FAKE_URL)
  await page.getByLabel('Token', { exact: true }).fill(TOKEN)
  await page.keyboard.press('Escape')

  // Adiciona uma tarefa - fica pendente.
  const campo = main.getByPlaceholder('Adicionar tarefa').first()
  await campo.fill('Sincronizar isto')
  await campo.press('Enter')

  // O rótulo "N alteração pendente" só aparece quando o status é "idle";
  // aqui, logo após fechar as Configurações, o status ainda é
  // "não configurado" (o sync automático de abertura rodou antes de haver
  // URL/token) - só o contador numérico ao lado do botão aparece já.
  const indicator = page.getByRole('status')
  await expect(indicator.locator('span', { hasText: '1' })).toBeVisible()

  // "Sincronizar agora" pelo botão do indicador.
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()

  await expect(indicator.filter({ hasText: /^Sincronizado às/u })).toBeVisible({
    timeout: 10_000,
  })
  expect(server.revisionNow()).toBe(1)

  // A pendencia some depois de confirmado - nenhum contador numérico sobra.
  await expect(indicator.locator('span', { hasText: '1' })).toHaveCount(0)
})

test('token errado: o indicador mostra o erro especifico', async ({ page }) => {
  const server = createFakeServer()
  await page.route('https://script.google.com/**', (route) => server.handleRoute(route))

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByLabel('URL do Apps Script').fill(FAKE_URL)
  await page.getByLabel('Token', { exact: true }).fill('token-errado-mas-com-trinta-e-dois-chars')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Sincronizar agora' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Token recusado' })).toBeVisible()
})

test('Testar conexão na tela de Configurações usa o mesmo protocolo', async ({ page }) => {
  const server = createFakeServer()
  await page.route('https://script.google.com/**', (route) => server.handleRoute(route))

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByLabel('URL do Apps Script').fill(FAKE_URL)
  await page.getByLabel('Token', { exact: true }).fill(TOKEN)
  await page.getByRole('button', { name: 'Testar conexão' }).click()

  await expect(page.getByText('Conexão funcionando.')).toBeVisible()
})
