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
 * **Primeira correção usou `flex-wrap`** (o indicador caindo pra uma
 * segunda linha com os botões) - funcionava sem estourar, mas o usuário
 * achou a quebra de linha feia e preferiu menos informação na barra a uma
 * barra de duas linhas. Revertido: `SyncIndicator.tsx` agora mostra um
 * rótulo bem mais curto nos celulares (o texto completo continua no
 * `title`) - curto o bastante pra nunca mais precisar quebrar linha.
 * `overflow-x: hidden` em `html`/`body` continua como rede de segurança.
 */
test.use({ viewport: { width: 320, height: 760 } })

test('nos 320px, os quatro botoes do cabecalho cabem numa linha so, sem estourar a pagina', async ({
  page,
}) => {
  const sync = page.getByRole('button', { name: 'Sincronizar agora' })
  const historico = page.getByRole('button', { name: 'Histórico' })
  const config = page.getByRole('button', { name: 'Configurações' })
  // ThemeToggle: rotulo dinamico ("Tema claro/escuro/do sistema") - padrao
  // de um contexto novo do Playwright (sem localStorage) e "do sistema".
  const tema = page.getByRole('button', { name: 'Tema do sistema' })

  await expect(sync).toBeVisible()
  await expect(historico).toBeVisible()
  await expect(config).toBeVisible()
  await expect(tema).toBeVisible()

  // Os quatro ficam na MESMA linha (preferencia explicita do usuario a
  // quebrar linha) - o topo de cada um tem que estar bem proximo do topo
  // dos outros, nao numa linha abaixo.
  const tops = await Promise.all(
    [sync, historico, config, tema].map(async (locator) => (await locator.boundingBox())?.y),
  )
  // Tolerancia pequena pro desalinhamento natural entre o botao de icone
  // de 36px (Historico/Config/Tema) e o botao interno de "sincronizar
  // agora" (24px, centralizado dentro do indicador mais alto) - bem menor
  // que a altura de uma linha inteira (~36px), que e o que uma quebra real
  // produziria.
  const [first, ...rest] = tops
  for (const top of rest) {
    expect(Math.abs((top ?? 0) - (first ?? 0))).toBeLessThan(10)
  }

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
