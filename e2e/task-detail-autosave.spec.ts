import { expect, test } from './fixtures.ts'

/**
 * Regressão de um problema real relatado pelo usuário: "às vezes estou no
 * meio de uma tarefa e acabo perdendo" o que tinha digitado no painel de
 * detalhe. A causa era uma decisão deliberada de design (docs seção 5.5,
 * registrada no CLAUDE.md): os campos de texto só salvavam no `onBlur` -
 * "editar um campo e sair dele é um evento discreto o bastante pra não
 * precisar de temporizador". Essa premissa supõe que a pessoa sempre sai
 * do campo de propósito; uma interrupção fora do controle dela (trocar de
 * app no celular, o navegador reclamar a aba em segundo plano) encerra a
 * edição sem nunca disparar o `onBlur` - o texto digitado e ainda não
 * "solto" do campo se perdia por inteiro.
 *
 * `useDebouncedCallback` (src/ui/hooks/) agora salva sozinho depois de uma
 * pausa de digitação, mesmo sem sair do campo. Este teste simula
 * exatamente a interrupção: digita, espera a pausa, e recarrega a página
 * SEM nunca tirar o foco do campo - o `onBlur` nunca dispara, só o
 * autosave poderia ter salvo.
 */
test('texto digitado no painel de detalhe sobrevive a uma interrupção sem sair do campo', async ({
  page,
}) => {
  const main = page.locator('main')
  const campo = main.getByPlaceholder('Adicionar tarefa').first()
  await campo.fill('Tarefa para testar autosave')
  await campo.press('Enter')

  await main.getByText('Tarefa para testar autosave').click()
  const dialog = page.getByRole('dialog')
  const notas = dialog.getByLabel('Notas')

  await notas.click()
  await notas.pressSequentially('Nota digitada sem nunca sair do campo')

  // Espera passar da pausa de debounce do autosave (1.5s) - sem clicar em
  // lugar nenhum, o foco nunca sai do campo e o onBlur nunca dispara.
  await page.waitForTimeout(1_900)

  // Simula a interrupção: recarrega sem nenhum salvamento "de saída" -
  // só o autosave já em voo (ou já concluído) poderia ter persistido isso.
  await page.reload()

  await main.getByText('Tarefa para testar autosave').click()
  await expect(page.getByRole('dialog').getByLabel('Notas')).toHaveValue(
    'Nota digitada sem nunca sair do campo',
  )
})
