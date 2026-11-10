import { ArrowLeft, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNote } from '@/db/noteHooks.ts'
import { deleteNoteById, restoreNoteById } from '@/db/notesRepo.ts'
import { getDB } from '@/db/schema.ts'
import { isFavorite } from '@/domain/favorite.ts'
import type { Note } from '@/domain/schema.ts'
import { toggleNoteFavorite } from '@/ui/actions/toggleFavorite.ts'
import { FavoriteButton } from '@/ui/components/FavoriteButton.tsx'
import { navigate } from '@/ui/router/store.ts'
import { pushUndo } from '@/ui/undo/store.ts'
import { NoteEditorForm } from './NoteEditorForm.tsx'

export interface NoteEditorProps {
  /** `null` = compose de uma nova anotação. */
  noteId: string | null
  /**
   * Mobile: o editor abre em tela cheia com uma barra própria de "Voltar" e
   * excluir, no lugar do menu inferior (`docs/prompt-anotacoes.md` seção
   * 3.1). No desktop (2º painel do layout lado a lado), `false` - a tela
   * de anotações já tem seu próprio cabeçalho.
   */
  showTopBar?: boolean
}

function NoteFavoriteButton({ note }: { note: Note }) {
  return (
    <FavoriteButton
      favorite={isFavorite(note)}
      onToggle={() => {
        toggleNoteFavorite(note)
      }}
      className="size-8 rounded-md"
      iconClassName="size-4"
    />
  )
}

function EditorTopBar({ onDelete, actions }: { onDelete: (() => void) | null; actions?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'notes-list' })
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar
      </button>
      <div className="flex items-center gap-1">
        {actions}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Excluir anotação"
            title="Excluir"
            className="inline-flex size-8 items-center justify-center rounded-md text-text-subtle hover:bg-surface-muted hover:text-q4-ink"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Casca do editor: resolve o objeto `Note` (ou decide que é compose de uma
 * anotação nova) antes de montar `NoteEditorForm`, que nasce com o estado
 * local semeado de um objeto já em mãos - nunca de uma releitura
 * assíncrona ainda em voo (mesma lição do bug real em `TriageOverlay`, ver
 * CLAUDE.md).
 */
export function NoteEditor({ noteId, showTopBar = false }: NoteEditorProps) {
  const liveNote = useNote(noteId)
  // `useState` (lido durante o render), não `useRef` (o oxlint recusa ler
  // `.current` durante o render - ver CLAUDE.md, mesmo ajuste já feito em
  // `useDebouncedCallback.ts`): gerado uma vez, estável enquanto a sessão
  // de compose durar.
  const [composeId] = useState(() => crypto.randomUUID())

  if (noteId === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {showTopBar ? <EditorTopBar onDelete={null} /> : null}
        <NoteEditorForm key="compose" note={null} composeId={composeId} />
      </div>
    )
  }

  // `liveNote.id !== noteId`: defesa ao trocar de uma anotacao para outra
  // no desktop - se `useLiveQuery` ainda devolver o resultado da consulta
  // ANTERIOR enquanto a nova resolve, a estrela (e o excluir) agiriam por
  // um instante sobre a anotacao que acabou de sair. Trata como
  // "carregando" ate o id bater.
  if (liveNote === undefined || liveNote.id !== noteId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-text-subtle">
        Carregando…
      </div>
    )
  }

  // Captura num `const` logo apos a checagem - uma `function` declarada
  // (hoisted) nao herda a narrowing do `if` acima quando CHAMADA depois,
  // so quando lida no mesmo ponto do codigo.
  const note = liveNote

  function handleDelete(): void {
    const db = getDB()
    deleteNoteById(db, note.id).catch((error: unknown) => {
      console.error('Falha ao excluir a anotação', error)
    })
    navigate({ screen: 'notes-list' })
    pushUndo({
      id: note.id,
      message: 'Anotação excluída.',
      undo: async () => {
        await restoreNoteById(db, note.id)
      },
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showTopBar ? (
        <EditorTopBar onDelete={handleDelete} actions={<NoteFavoriteButton note={note} />} />
      ) : (
        // Desktop (2o painel): sem barra de "Voltar", so a estrela no canto.
        <div className="flex shrink-0 justify-end px-3 pt-2">
          <NoteFavoriteButton note={note} />
        </div>
      )}
      <NoteEditorForm key={note.id} note={note} />
    </div>
  )
}
