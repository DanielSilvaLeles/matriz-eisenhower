import { useDeletedNotes } from '@/db/noteHooks.ts'
import { restoreNoteById } from '@/db/notesRepo.ts'
import { getDB } from '@/db/schema.ts'

function formatDeletedAt(iso: string | null): string {
  if (iso === null) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function handleRestore(noteId: string): void {
  restoreNoteById(getDB(), noteId).catch((error: unknown) => {
    console.error('Falha ao restaurar a anotação', error)
  })
}

/**
 * "Excluídas recentemente" (`docs/prompt-anotacoes.md` seção 5): anotações
 * apagadas ficam aqui por 30 dias, podendo ser restauradas - mesmo espaço
 * de "Histórico", aba própria (`HistoryPanel.tsx`). A limpeza definitiva
 * depois de 30 dias é da mesclagem de sync (fase 2), não daqui - esta tela
 * só lista e restaura.
 */
export function NotesTrashSection() {
  const deleted = useDeletedNotes()

  if (deleted.length === 0) {
    return <p className="py-2 text-xs text-text-subtle">Nenhuma anotação excluída recentemente.</p>
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {deleted.map((note) => (
        <li
          key={note.id}
          className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-text">
              {note.title ?? note.body.split(/\r\n|\r|\n/u)[0]}
            </p>
            <p className="mt-0.5 text-[11px] text-text-subtle">
              Excluída em {formatDeletedAt(note.deleted_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              handleRestore(note.id)
            }}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[12px] text-text-muted hover:bg-surface-muted hover:text-text"
          >
            Restaurar
          </button>
        </li>
      ))}
    </ul>
  )
}
