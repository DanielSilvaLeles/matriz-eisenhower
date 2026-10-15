import { useSyncExternalStore } from 'react'

/**
 * Le uma media query real, para decidir QUAL arvore de layout montar -
 * nao so qual mostrar por CSS. Montar as duas arvores ao mesmo tempo (uma
 * escondida com `sm:hidden`) duplicava ids e registros do dnd-kit (o
 * quadrante que a MobileMatrixView mostra por padrao - "Fazer" - virava um
 * alvo de arraste invisivel para o droppable de verdade, ja que o id
 * colidia com uma copia oculta de tamanho zero).
 *
 * `useSyncExternalStore` (nao useState+useEffect): evita o "flash" de
 * montar a arvore errada no primeiro render e trocar logo em seguida - o
 * valor inicial ja vem certo, direto do `matchMedia`, sem depender de CSR
 * ser sincrono (este app nao tem SSR, entao nao ha risco de mismatch de
 * hidratacao - so a escolha certa desde o primeiro frame).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => {
        media.removeEventListener('change', onChange)
      }
    },
    () => window.matchMedia(query).matches,
  )
}
