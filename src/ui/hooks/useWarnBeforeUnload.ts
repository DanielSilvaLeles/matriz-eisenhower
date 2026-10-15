import { useEffect } from 'react'

/**
 * Aviso nativo do navegador ao fechar a aba com alterações pendentes
 * (docs secao 6.3) - so dispara quando `shouldWarn` for true no momento do
 * fechamento, nunca de surpresa com o banco em dia.
 */
export function useWarnBeforeUnload(shouldWarn: boolean): void {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!shouldWarn) return
      event.preventDefault()
      // `returnValue` e depreciado, mas ainda e o unico jeito do Safari (e
      // de navegadores mais antigos) mostrar o aviso nativo - preventDefault()
      // sozinho nao basta fora do Chromium/Firefox recentes. Navegadores
      // modernos ignoram o texto customizado e mostram a mensagem padrao deles.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- compatibilidade com Safari.
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [shouldWarn])
}
