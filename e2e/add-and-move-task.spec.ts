import { expect, test } from './fixtures.ts'

/**
 * Fluxo essencial 1 (docs secao 9): adicionar e mover tarefa. Cobre os tres
 * caminhos de mover que o documento pede como alternativas entre si
 * (docs secao 4.5) - teclado, arrastar e reordenar dentro do quadrante -
 * porque e exatamente isso que a interacao manual no navegador nao
 * conseguiu confirmar com confianca para o arrastar (ferramenta de
 * automacao com pouca fidelidade de ponteiro); o mouse do Playwright simula
 * uma sequencia real de movimento, o que dnd-kit precisa para funcionar.
 *
 * O viewport padrao do Playwright e de tamanho desktop, mas o layout mobile
 * (fase 1c, secao 5.7) tambem existe na mesma pagina - so escondido por CSS
 * (`sm:hidden`), nao removido do DOM. Por isso os locators ficam escopados
 * dentro de <main>, que e so o layout desktop; sem isso, "Adicionar tarefa"
 * e "Capturar uma ideia" bateriam em dois elementos (um por layout).
 */

test('carrega direto na matriz, sem tela intermediaria', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Matriz de Eisenhower' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fazer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible()
})

test('adiciona uma tarefa so com teclado e o contador atualiza', async ({ page }) => {
  const main = page.locator('main')
  const campo = main.getByPlaceholder('Adicionar tarefa').first()
  await campo.click()
  await campo.fill('Revisar PR do time')
  await campo.press('Enter')

  await expect(main.getByText('Revisar PR do time')).toBeVisible()
  await expect(main.locator('section[aria-label^="Fazer"]')).toContainText('1/10')
})

test('move a tarefa focada pelo atalho de teclado, com desfazer', async ({ page }) => {
  const main = page.locator('main')
  const campo = main.getByPlaceholder('Adicionar tarefa').first()
  await campo.fill('Tarefa a mover')
  await campo.press('Enter')

  // .focus() (nao .click()): o atalho de teclado age sobre a tarefa
  // focada, e clicar no checkbox a concluiria em vez de so focar.
  const checkbox = main.getByRole('checkbox', { name: 'Concluir "Tarefa a mover"' })
  await checkbox.focus()
  await page.keyboard.press('2')

  await expect(main.locator('section[aria-label^="Agendar"]').getByText('Tarefa a mover')).toBeVisible()
  await expect(page.getByText('movida para Agendar')).toBeVisible()

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(main.locator('section[aria-label^="Fazer"]').getByText('Tarefa a mover')).toBeVisible()
})

test('arrasta uma tarefa da caixa de entrada para um quadrante', async ({ page }) => {
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')
  await captura.fill('Item da caixa de entrada')
  await captura.press('Enter')

  const inboxRow = main.locator('[data-task-list="inbox"] [data-task-id]').first()
  await expect(inboxRow).toContainText('Item da caixa de entrada')

  const handle = inboxRow.locator('button[aria-hidden="true"]')
  const target = main.locator('[data-task-list="q1"]')

  const handleBox = await handle.boundingBox()
  const targetBox = await target.boundingBox()
  if (!handleBox || !targetBox) throw new Error('Elemento sem caixa delimitadora.')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  // Varios passos intermediarios: dnd-kit precisa de movimento real para
  // registrar a ativacao (distance: 4) e atualizar o destino sob o ponteiro.
  const steps = 12
  const fromX = handleBox.x + handleBox.width / 2
  const fromY = handleBox.y + handleBox.height / 2
  const toX = targetBox.x + targetBox.width / 2
  const toY = targetBox.y + targetBox.height / 2
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps)
  }
  await page.mouse.up()

  await expect(main.locator('section[aria-label^="Fazer"]').getByText('Item da caixa de entrada')).toBeVisible()
  await expect(main.locator('[data-task-list="inbox"] [data-task-id]')).toHaveCount(0)
})

test('reordena por arraste dentro do mesmo quadrante', async ({ page }) => {
  const main = page.locator('main')
  const campo = main.getByPlaceholder('Adicionar tarefa').first()
  await campo.fill('Primeira')
  await campo.press('Enter')
  await campo.fill('Segunda')
  await campo.press('Enter')

  const list = main.locator('[data-task-list="q1"]')
  await expect(list.locator('[data-task-id]')).toHaveCount(2)
  await expect(list.locator('[data-task-id]').first()).toContainText('Primeira')

  const secondRow = list.locator('[data-task-id]').nth(1)
  const firstRow = list.locator('[data-task-id]').first()
  const handle = secondRow.locator('button[aria-hidden="true"]')

  const handleBox = await handle.boundingBox()
  const firstBox = await firstRow.boundingBox()
  if (!handleBox || !firstBox) throw new Error('Elemento sem caixa delimitadora.')

  const fromX = handleBox.x + handleBox.width / 2
  const fromY = handleBox.y + handleBox.height / 2
  const toX = firstBox.x + firstBox.width / 2
  const toY = firstBox.y + firstBox.height / 2

  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps)
  }
  await page.mouse.up()

  await expect(list.locator('[data-task-id]').first()).toContainText('Segunda')
})
