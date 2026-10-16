import { NotebookPen, Plus } from 'lucide-react'
import { INBOX_CAPTURE_FIELD_ID } from './CaptureField.tsx'
import { navigate } from '@/ui/router/store.ts'
import { useRoute } from '@/ui/router/useRoute.ts'
import { cn } from '@/lib/utils.ts'

function focusIdeiaField(): void {
  document.querySelector<HTMLElement>(`#${INBOX_CAPTURE_FIELD_ID}`)?.focus()
}

/**
 * Navegação do desktop (`docs/prompt-anotacoes.md` seção 3.2): abas
 * Matriz|Anotações + botões "+ Ideia"/"+ Anotação". "+ Ideia" não abre
 * nenhuma folha nova - o desktop já tem o campo de captura sempre visível
 * na caixa de entrada (`InboxPanel.tsx`); o botão só foca esse campo (a
 * mesma ação do atalho `N`), sem duplicar interface.
 */
export function DesktopNav() {
  const route = useRoute()
  const onMatrix = route.screen === 'matrix'
  // Editor de anotação também conta como "área Anotações" - sem isso, abrir
  // uma anotação deixava as duas abas apagadas, sem indicar onde se está.
  const onNotes = route.screen === 'notes-list' || route.screen === 'note-editor'

  return (
    <div className="flex items-center gap-3">
      <nav aria-label="Áreas do app" className="flex gap-1 rounded-md border border-border p-0.5">
        <button
          type="button"
          onClick={() => {
            navigate({ screen: 'matrix' })
          }}
          aria-current={onMatrix ? 'page' : undefined}
          className={cn(
            'rounded px-2.5 py-1 text-[12px]',
            onMatrix ? 'bg-surface-muted font-medium text-text' : 'text-text-muted hover:text-text',
          )}
        >
          Matriz
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ screen: 'notes-list' })
          }}
          aria-current={onNotes ? 'page' : undefined}
          className={cn(
            'rounded px-2.5 py-1 text-[12px]',
            onNotes ? 'bg-surface-muted font-medium text-text' : 'text-text-muted hover:text-text',
          )}
        >
          Anotações
        </button>
      </nav>

      <button
        type="button"
        onClick={focusIdeiaField}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Ideia
        <kbd className="ml-0.5 text-[10px] text-text-subtle">N</kbd>
      </button>
      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'note-editor', noteId: null })
        }}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <NotebookPen className="size-3.5" aria-hidden="true" />
        Anotação
        <kbd className="ml-0.5 text-[10px] text-text-subtle">A</kbd>
      </button>
    </div>
  )
}
