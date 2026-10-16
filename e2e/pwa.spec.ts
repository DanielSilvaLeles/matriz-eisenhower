import { z } from 'zod'
import { expect, test } from './fixtures.ts'

/** So os campos que este arquivo checa - nao o manifest inteiro. */
const manifestSchema = z.object({
  start_url: z.string(),
  scope: z.string(),
  display: z.string(),
  icons: z.array(z.object({ sizes: z.string() })),
  share_target: z.object({ method: z.string() }),
  shortcuts: z.array(z.object({ name: z.string(), url: z.string() })),
})

/**
 * PWA (docs secao 8): manifest valido no subcaminho certo, app funciona
 * offline depois da primeira visita, share target e atalho "Nova ideia"
 * (renomeado na extensão "Anotações" - era "Nova anotação", mas sempre foi
 * a captura rápida de ideia; ver `docs/prompt-anotacoes.md` seção 3.4)
 * (docs secao 9: "teste de instalação do PWA no subcaminho - é onde esse
 * tipo de configuração costuma falhar").
 *
 * Nao da pra "instalar" de verdade num teste automatizado (e um fluxo do
 * sistema operacional) - o equivalente verificavel e os criterios que o
 * navegador checa para oferecer a instalacao: manifest valido com ícones
 * 192/512, `start_url`/`scope` certos, e um service worker ativo.
 */

test('manifest valido, com start_url e scope no subcaminho certo', async ({ page }) => {
  await page.goto('/')

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  if (manifestHref === null) throw new Error('Pagina sem <link rel="manifest">.')
  expect(manifestHref).toBe('/matriz-eisenhower/manifest.webmanifest')

  const raw: unknown = await page.evaluate(async (href): Promise<unknown> => {
    const response = await fetch(href)
    return response.json()
  }, manifestHref)
  const manifest = manifestSchema.parse(raw)

  expect(manifest.start_url).toBe('/matriz-eisenhower/')
  expect(manifest.scope).toBe('/matriz-eisenhower/')
  expect(manifest.display).toBe('standalone')
  const sizes = manifest.icons.map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
  expect(manifest.share_target.method).toBe('GET')

  // Extensão "Anotações" (docs/prompt-anotacoes.md seção 3.4): dois
  // atalhos com nomes que não se confundem - "ideia" é a captura rápida
  // que já existia (renomeada), "anotação" é o editor de texto longo novo.
  const shortcutByName = new Map(manifest.shortcuts.map((shortcut) => [shortcut.name, shortcut.url]))
  expect(shortcutByName.get('Nova ideia')).toBe('/matriz-eisenhower/?captura=1')
  expect(shortcutByName.get('Nova anotação')).toBe('/matriz-eisenhower/#/anotacoes/nova')
})

test('indicador mostra "Offline" na hora, sem esperar uma tentativa de sync', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Pagina ja carregada, online - so entao desliga a rede, para o evento
  // nativo 'offline' disparar de verdade (carregar ja offline nao dispara
  // o evento, so o estado inicial de navigator.onLine).
  await context.setOffline(true)

  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible()

  await context.setOffline(false)
})

test('funciona offline depois da primeira visita', async ({ page, context }) => {
  await page.goto('/')
  // Espera o service worker terminar de instalar e assumir o controle -
  // so entao o cache do app shell esta pronto para servir sem rede.
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Matriz de Eisenhower' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fazer' })).toBeVisible()

  await context.setOffline(false)
})

test('share target: title+text+url viram UMA tarefa so na caixa de entrada', async ({ page }) => {
  const main = page.locator('main')

  await page.goto(
    '/?title=Proposta%20do%20fornecedor&text=Ver%20antes%20de%20responder&url=https%3A%2F%2Fexemplo.com%2Fdoc',
  )

  await expect(
    main.locator('[data-task-list="inbox"] [data-task-id]'),
  ).toHaveCount(1)
  await expect(main.getByText('Proposta do fornecedor — Ver antes de responder')).toBeVisible()
  // A query string precisa sumir, senao um recarregamento repetiria a captura.
  await expect(page).toHaveURL(/\/matriz-eisenhower\/$/u)
})

test('atalho "Nova ideia" (?captura=1) foca o campo de captura', async ({ page }) => {
  await page.goto('/?captura=1')

  await expect(page.getByPlaceholder('Capturar uma ideia…').first()).toBeFocused()
  await expect(page).toHaveURL(/\/matriz-eisenhower\/$/u)
})
