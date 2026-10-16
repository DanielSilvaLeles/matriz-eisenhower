import { expect, test } from './fixtures.ts'

/**
 * Extensão "Anotações + menu inferior" (`docs/prompt-anotacoes.md`),
 * critérios de aceite da seção 11 que dá pra automatizar: criar uma
 * anotação e ela aparecer na lista com texto/data, texto digitado
 * sobrevive a uma recarga sem nunca sair do campo (mesma técnica de
 * `e2e/task-detail-autosave.spec.ts`), "Ideia" e "Anotar" nunca se
 * confundem, busca funciona.
 */

test('criar uma anotação pelo desktop: aparece na lista com data de inclusão', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotação' }).click()

  const editor = page.getByPlaceholder('Comece a digitar…')
  await expect(editor).toBeFocused()
  await editor.fill('Reunião com o fornecedor sobre o contrato')

  await expect(page.getByText('Salvo')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Reunião com o fornecedor sobre o contrato/u }),
  ).toBeVisible()
})

test('texto digitado numa anotação nova sobrevive a uma recarga sem nunca sair do campo', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Anotação' }).click()

  const editor = page.getByPlaceholder('Comece a digitar…')
  await editor.pressSequentially('Nota que não pode se perder')

  // Espera passar da pausa do autosave (500ms) sem nunca clicar fora do
  // campo - o onBlur literalmente nunca dispara neste teste.
  await page.waitForTimeout(900)

  await page.reload()

  await page.getByRole('button', { name: /Nota que não pode se perder/u }).click()
  await expect(page.getByPlaceholder('Comece a digitar…')).toHaveValue('Nota que não pode se perder')
})

test('"Ideia" e "Anotar" nunca se confundem: um vai pra caixa de entrada, o outro vira anotação', async ({
  page,
}) => {
  const main = page.locator('main')

  await page.getByRole('button', { name: 'Ideia' }).click()
  await main.getByPlaceholder('Capturar uma ideia…').fill('Cobrar fornecedor X')
  await main.getByPlaceholder('Capturar uma ideia…').press('Enter')
  await expect(main.locator('[data-task-list="inbox"]').getByText('Cobrar fornecedor X')).toBeVisible()

  await page.getByRole('button', { name: 'Anotação' }).click()
  await page.getByPlaceholder('Comece a digitar…').fill('Texto da reunião de hoje')
  await expect(page.getByText('Salvo')).toBeVisible()

  // A ideia virou tarefa na caixa de entrada, NUNCA uma anotação - e a
  // anotação não aparece na caixa de entrada.
  await expect(main.locator('[data-task-list="inbox"]').getByText('Texto da reunião de hoje')).toHaveCount(0)
})

test('busca encontra uma anotação pelo texto, ignorando acentos', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotação' }).click()
  await page.getByPlaceholder('Comece a digitar…').fill('Reunião sobre orçamento do próximo trimestre')
  await expect(page.getByText('Salvo')).toBeVisible()

  await page.getByRole('button', { name: 'Anotações', exact: true }).click()
  await page.locator('#notes-search').fill('orcamento')

  await expect(
    page.getByRole('button', { name: /Reunião sobre orçamento do próximo trimestre/u }),
  ).toBeVisible()
})

test('linha de ação "[ ] " vira tarefa na caixa de entrada, com link de volta para a anotação', async ({
  page,
}) => {
  const main = page.locator('main')

  await page.getByRole('button', { name: 'Anotação' }).click()
  const editor = page.getByPlaceholder('Comece a digitar…')
  await editor.fill('Reunião\n[ ] Cobrar proposta do fornecedor')
  await expect(page.getByText('Salvo')).toBeVisible()

  const sendButton = page.getByRole('button', { name: 'Caixa de entrada' })
  await expect(sendButton).toBeVisible()
  await sendButton.click()

  // A linha de ação some da lista de pendentes do editor (foi enviada).
  await expect(sendButton).toHaveCount(0)
  // O corpo da anotação mostra o marcador trocado por "[→]".
  await expect(editor).toHaveValue(/\[→\] Cobrar proposta do fornecedor/u)

  // A tarefa aparece na caixa de entrada - precisa voltar para a Matriz
  // primeiro, a tela de anotações não mostra a caixa de entrada.
  await page.getByRole('button', { name: 'Matriz' }).click()
  const inboxItem = main.locator('[data-task-list="inbox"] [data-task-id]').filter({
    hasText: 'Cobrar proposta do fornecedor',
  })
  await expect(inboxItem).toBeVisible()

  // Enter sobre a tarefa focada abre o detalhe (useGlobalShortcuts.ts) -
  // mesmo contrato de `data-task-anchor` que os itens de quadrante usam.
  await inboxItem.click()
  await page.keyboard.press('Enter')

  const originLink = page.getByRole('button', { name: 'Ver anotação de origem' })
  await expect(originLink).toBeVisible()
  await originLink.click()

  // Volta para a MESMA anotação, com a linha já marcada como enviada.
  await expect(page.getByPlaceholder('Comece a digitar…')).toHaveValue(/\[→\] Cobrar proposta do fornecedor/u)
})

test('menu inferior do celular: uma única barra, Anotar abre o editor focado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Matriz' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Ideia' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Nova anotação' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Anotações' })).toBeVisible()

  // A antiga barra de captura fixa (docs SPEC secao 5.7) nao existe mais -
  // nunca duas barras empilhadas (docs/prompt-anotacoes.md secao 3.1).
  await expect(page.getByPlaceholder('Capturar uma ideia…')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Nova anotação' }).click()
  await expect(page.getByPlaceholder('Comece a digitar…')).toBeFocused()

  // No editor em tela cheia, o menu inferior some - vira a barra "Voltar".
  await expect(nav).toBeHidden()
  await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
})
