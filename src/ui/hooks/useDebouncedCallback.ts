import { useCallback, useEffect, useRef } from 'react'

/**
 * Devolve uma versão "atrasada" de `callback`: cada chamada a `run`
 * reinicia o temporizador de `delayMs` - só a ÚLTIMA chamada dentro da
 * janela de inatividade executa de verdade. `cancel` descarta uma chamada
 * pendente sem executá-la (usado quando outro caminho - like `onBlur` - já
 * vai salvar na hora, pra não duplicar a escrita).
 *
 * Usado para autosave enquanto a pessoa digita em `TaskDetailFields.tsx`
 * (docs seção 5.5): o campo salvava só no `onBlur`, uma decisão deliberada
 * registrada no CLAUDE.md ("editar um campo e sair dele é um evento
 * discreto o bastante pra não precisar de temporizador") - mas essa
 * premissa supõe que a pessoa SEMPRE sai do campo de propósito. Na prática
 * relatada pelo usuário, uma interrupção fora do controle da pessoa (trocar
 * de app no celular e o sistema operacional reclamar a aba em segundo
 * plano, por exemplo) também encerra a edição, sem nunca disparar o
 * `onBlur` - tudo que foi digitado e ainda não tinha sido "solto" do campo
 * se perdia por inteiro. O `onBlur` continua existindo como salvamento
 * imediato de qualquer jeito; isso aqui é a rede de segurança pro meio do
 * caminho.
 */
export function useDebouncedCallback<Args extends readonly unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): { run: (...args: Args) => void; cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // "Ref sempre atual": grava DEPOIS do render (nunca durante), senao
  // `run` poderia chamar uma versao desatualizada de `callback` presa no
  // fechamento de quando `useDebouncedCallback` foi chamado pela ultima vez.
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Desarma o temporizador se o componente sair de tela com uma escrita
  // ainda pendente - `onBlur`/desmontagem já cobrem a gravação final.
  useEffect(() => cancel, [cancel])

  const run = useCallback(
    (...args: Args): void => {
      cancel()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        callbackRef.current(...args)
      }, delayMs)
    },
    [cancel, delayMs],
  )

  return { run, cancel }
}
