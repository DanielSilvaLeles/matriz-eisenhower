import { expect, test } from './fixtures.ts'

/**
 * Fluxo essencial 2 (docs secao 9): triagem da caixa de entrada. Cobre o
 * atalho `T`, as teclas `1`-`4`/`S` dentro do modo, "Me ajude a decidir" e
 * a tela final de caixa zerada - o que a interacao manual no navegador ja
 * confirmou (ver CLAUDE.md), agora fixado em CI.
 *
 * O atalho global `T` so age fora de um campo editavel (useGlobalShortcuts.ts)
 * - depois de `captura.press('Enter')` o foco continua no proprio campo de
 * captura, entao cada teste clica no titulo (h1) antes de `T` para sair do
 * campo, do mesmo jeito que uma pessoa clicaria em qualquer lugar neutro.
 */

test('triagem por teclado: manda para Agendar, pula a data, e chega na caixa zerada', async ({
  page,
}) => {
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')

  await captura.fill('Responder e-mail do cliente')
  await captura.press('Enter')
  await page.locator('h1').click()
  await page.keyboard.press('t')

  const dialog = page.getByRole('dialog')
  await expect(page.getByRole('heading', { name: 'Triagem' })).toBeVisible()
  const itemTitle = dialog.getByText('Responder e-mail do cliente')
  await expect(itemTitle).toBeVisible()
  // Clica no proprio item: garante que o foco esta dentro do dialogo antes
  // do atalho de teclado - o primeiro keydown logo apos abrir por `T` corre
  // o risco de chegar antes do Radix terminar de mover o foco para dentro.
  await itemTitle.click()

  // Manda para Agendar (tecla 2) - entra no passo de data.
  await page.keyboard.press('2')
  await expect(dialog.getByText('Quando agendar')).toBeVisible()

  // "Pular" sem data: pelo botao, nao pela tecla (S la dentro tem
  // significado diferente do modo item - so o botao existe nesse passo).
  await dialog.getByRole('button', { name: 'Pular' }).click()

  await expect(dialog.getByText('Caixa de entrada zerada!')).toBeVisible()
  await expect(dialog.getByText('1 de 1')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(main.locator('section[aria-label^="Agendar"]').getByText('Responder e-mail do cliente')).toBeVisible()
  await expect(main.locator('[data-task-list="inbox"] [data-task-id]')).toHaveCount(0)
})

test('"Me ajude a decidir" sugere o quadrante e move ao confirmar', async ({ page }) => {
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')

  await captura.fill('Eliminar reuniao sem pauta')
  await captura.press('Enter')

  await main.getByRole('button', { name: 'Triar agora' }).click()
  const dialog = page.getByRole('dialog')

  await dialog.getByRole('button', { name: 'Me ajude a decidir' }).click()
  await dialog.getByRole('button', { name: 'Não' }).first().click()
  await dialog.getByRole('button', { name: 'Não' }).nth(1).click()

  await expect(dialog.getByText('Sugestão:')).toBeVisible()
  await expect(dialog.getByText('Eliminar', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Mandar' }).click()

  await expect(dialog.getByText('Caixa de entrada zerada!')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(
    main.locator('section[aria-label^="Eliminar"]').getByText('Eliminar reuniao sem pauta'),
  ).toBeVisible()
})

test('editar o titulo durante a triagem (tecla E)', async ({ page }) => {
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')

  await captura.fill('titulo errado')
  await captura.press('Enter')
  await page.locator('h1').click()
  await page.keyboard.press('t')
  await page.keyboard.press('e')

  const dialog = page.getByRole('dialog')
  const editInput = dialog.getByRole('textbox')
  await editInput.fill('Titulo corrigido')
  await dialog.getByRole('button', { name: 'Salvar' }).click()

  await expect(dialog.getByText('Titulo corrigido', { exact: true })).toBeVisible()

  // Agora manda para Fazer (q1, sem passo extra) e confirma a caixa zerada.
  await page.keyboard.press('1')
  await expect(dialog.getByText('Caixa de entrada zerada!')).toBeVisible()
})

test('triagem de dois itens em sequencia: o segundo item avanca de verdade', async ({ page }) => {
  // Regressao de um bug real relatado pelo usuario: triar o primeiro item
  // funcionava, mas o segundo "parecia nao fazer nada" - o item continuava
  // aparecendo. Causa raiz era uma corrida (ver CLAUDE.md, "Bug real:
  // segundo item da triagem..."), mas nenhum teste cobria sequer o fluxo
  // normal de DOIS itens - so um por vez. Este teste fecha essa lacuna.
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')

  await captura.fill('Primeiro item')
  await captura.press('Enter')
  await captura.fill('Segundo item')
  await captura.press('Enter')

  await page.locator('h1').click()
  await page.keyboard.press('t')

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Primeiro item')).toBeVisible()
  await dialog.getByText('Primeiro item').click()

  // Fazer, sem passo extra.
  await page.keyboard.press('1')
  await expect(dialog.getByText('Segundo item')).toBeVisible()
  await expect(dialog.getByText('1 de 2')).toBeVisible()

  // Eliminar, sem passo extra.
  await page.keyboard.press('4')
  await expect(dialog.getByText('Caixa de entrada zerada!')).toBeVisible()
  await expect(dialog.getByText('2 de 2')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(main.locator('section[aria-label^="Fazer"]').getByText('Primeiro item')).toBeVisible()
  await expect(main.locator('section[aria-label^="Eliminar"]').getByText('Segundo item')).toBeVisible()
  await expect(main.locator('[data-task-list="inbox"] [data-task-id]')).toHaveCount(0)
})

test('digitar dois destinos em sequencia para o mesmo item so move uma vez', async ({ page }) => {
  // Mesma regressao acima, mas testando a trava diretamente: duas teclas
  // de destino disparadas sem esperar a primeira resolver nao podem gerar
  // duas movimentacoes concorrentes para o mesmo item - so a primeira vale,
  // a segunda e ignorada enquanto o passo estiver "ocupado".
  const main = page.locator('main')
  const captura = main.getByPlaceholder('Capturar uma ideia…')

  await captura.fill('Item unico')
  await captura.press('Enter')

  await page.locator('h1').click()
  await page.keyboard.press('t')

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Item unico')).toBeVisible()
  await dialog.getByText('Item unico').click()

  await Promise.all([page.keyboard.press('1'), page.keyboard.press('4')])

  await expect(dialog.getByText('Caixa de entrada zerada!')).toBeVisible()
  await page.keyboard.press('Escape')

  // Foi para exatamente UM quadrante - nunca os dois.
  await expect(main.locator('section[aria-label^="Fazer"]').getByText('Item unico')).toBeVisible()
  await expect(main.locator('section[aria-label^="Eliminar"]').getByText('Item unico')).toHaveCount(0)
})
