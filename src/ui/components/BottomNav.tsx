import { Home, Inbox, NotebookPen, StickyNote } from 'lucide-react'
import { useInboxCount } from '@/db/hooks.ts'
import { navigate } from '@/ui/router/store.ts'
import { useRoute } from '@/ui/router/useRoute.ts'
import { cn } from '@/lib/utils.ts'

export interface BottomNavProps {
  onOpenIdeia: () => void
}

/**
 * Menu inferior de acesso rápido (`docs/prompt-anotacoes.md` seção 3.1):
 * substitui a antiga barra de captura fixa (seção 5.7 do SPEC original) -
 * nunca as duas empilhadas. Só existe abaixo do breakpoint `sm`, igual ao
 * resto do layout mobile - App.tsx decide em qual rota ela aparece (nunca
 * no editor de anotação em tela cheia, que tem sua própria barra).
 */
export function BottomNav({ onOpenIdeia }: BottomNavProps) {
  const route = useRoute()
  const inboxCount = useInboxCount()
  const isMatrix = route.screen === 'matrix'
  const isNotesList = route.screen === 'notes-list'

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] sm:hidden"
    >
      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'matrix' })
        }}
        aria-current={isMatrix ? 'page' : undefined}
        className={cn(
          'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]',
          isMatrix ? 'font-semibold text-accent-ink' : 'text-text-muted',
        )}
      >
        <Home className="size-5" aria-hidden="true" />
        Matriz
        {inboxCount > 0 ? (
          <span className="absolute top-1 right-[calc(50%-1.25rem)] rounded-full bg-warn-soft px-1 text-[10px] font-semibold text-warn tabular-nums">
            {inboxCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={onOpenIdeia}
        className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] text-text-muted"
      >
        <Inbox className="size-5" aria-hidden="true" />
        Ideia
      </button>

      {/* Único destaque forte da barra (docs secao 8) - o resto fica em neutros. */}
      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'note-editor', noteId: null })
        }}
        aria-label="Nova anotação"
        className="relative -mt-3 flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] text-text-muted"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md">
          <NotebookPen className="size-5" aria-hidden="true" />
        </span>
        Anotar
      </button>

      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'notes-list' })
        }}
        aria-current={isNotesList ? 'page' : undefined}
        className={cn(
          'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]',
          isNotesList ? 'font-semibold text-accent-ink' : 'text-text-muted',
        )}
      >
        <StickyNote className="size-5" aria-hidden="true" />
        Anotações
      </button>
    </nav>
  )
}
