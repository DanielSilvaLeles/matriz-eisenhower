import { expect, test } from './fixtures.ts'

/**
 * Regressão de um bug real relatado pelo usuário: nos celulares mais
 * comuns (320-412px), os quatro itens do canto do cabeçalho (indicador de
 * sync + histórico + configurações + tema) não cabiam numa linha só -
 * `AppHeaderActions` não encolhia nem quebrava linha, então o último botão
 * ficava fisicamente fora do viewport (não só visualmente escondido:
 * inexistente na tela, sem nenhum aviso). Pior ainda, o estouro de UM
 * elemento bastava pra alargar o viewport de layout inteiro em navegadores
 * móveis, fazendo até o painel de detalhe (que não tinha nada de errado
 * sozinho) abrir cortado e com a página inteira parecendo "zoom errado" -
 * o usuário viu os dois sintomas e corretamente suspeitou que eram "o
 * mesmo problema" (ver CLAUDE.md).
 *
 * Corrigido com `flex-wrap`/`min-w-0` em `AppHeaderActions.tsx` (o estouro
 * em si) mais `overflow-x: hidden` em `html`/`body` (rede de segurança
 * contra qualquer estouro futuro se espalhar pela página inteira).
 */
test.use({ viewport: { width: 320, height: 760 } })

test('nos 320px, os quatro botoes do cabecalho cabem sem estourar a pagina', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Histórico' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Configurações' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible()
  // ThemeToggle: rotulo dinamico ("Tema claro/escuro/do sistema") - padrao
  // de um contexto novo do Playwright (sem localStorage) e "do sistema".
  await expect(page.getByRole('button', { name: 'Tema do sistema' })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('nos 320px, o painel de detalhe abre sem cortar a pagina', async ({ page }) => {
  const campo = page.getByPlaceholder('Adicionar tarefa').first()
  await campo.fill('Tarefa para checar o layout mobile')
  await campo.press('Enter')

  await page.getByText('Tarefa para checar o layout mobile').click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
