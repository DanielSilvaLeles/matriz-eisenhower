import { undoPending } from '@/ui/undo/store.ts'
import { usePendingUndo } from '@/ui/undo/useUndo.ts'

/**
 * Toast de desfazer (docs secao 4.4). `role="status"` ja e um anuncio pronto
 * para leitor de tela: nenhum sistema de anuncio separado precisa repetir a
 * mesma informacao quando uma tarefa e movida por teclado ou pelo menu
 * "Mover para" - o arrastar com dnd-kit tem seu proprio anuncio de fase
 * (iniciou, passou por cima, soltou), que e informacao diferente.
 */
export function UndoToast() {
  const pending = usePendingUndo()
  if (!pending) return null

  return (
    <output className="fixed inset-x-0 bottom-3 z-50 mx-auto flex w-fit max-w-[calc(100vw-24px)] items-center gap-3 rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13px] text-text shadow-lg pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]">
      <span>{pending.message}</span>
      <button
        type="button"
        onClick={() => {
          undoPending().catch((error: unknown) => {
            console.error('Falha ao desfazer', error)
          })
        }}
        className="shrink-0 font-semibold text-focus underline-offset-2 hover:underline"
      >
        Desfazer
      </button>
    </output>
  )
}
