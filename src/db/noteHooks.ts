/**
 * Leitura reativa de anotações - mesmo padrão de `src/db/hooks.ts`
 * (`useLiveQuery`), separado em arquivo próprio só para não estourar o
 * limite de linhas do lint ao crescer junto com o resto do app.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { Note } from '@/domain/schema.ts'
import { getDB } from './schema.ts'

const EMPTY_NOTES: readonly Note[] = []

/** Todas as anotações, incluindo as excluídas - a base para os hooks abaixo. */
function useAllNotes(): readonly Note[] {
  const db = getDB()
  return useLiveQuery(() => db.notes.toArray(), [], EMPTY_NOTES)
}

/**
 * Anotações ativas (não excluídas), da mais recente para a mais antiga por
 * `created_at` - a ordem padrão (`docs/prompt-anotacoes.md` seção 4). A
 * tela de lista oferece inverter; isso é estado de UI, não deste hook.
 */
export function useNotes(): readonly Note[] {
  const all = useAllNotes()
  return useMemo(
    () => all.filter((note) => !note.deleted).toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [all],
  )
}

/** Uma única anotação, ao vivo - usada pelo editor. */
export function useNote(noteId: string | null): Note | undefined {
  const db = getDB()
  return useLiveQuery(() => (noteId === null ? undefined : db.notes.get(noteId)), [noteId])
}

/** Quantidade de anotações ativas - usado no menu inferior/abas, se precisar de um contador. */
export function useNoteCount(): number {
  return useNotes().length
}

/**
 * Lixeira de 30 dias (seção 5): anotações excluídas, mais recente exclusão
 * primeiro. A limpeza de verdade (tombstone definitivo) é da mesclagem de
 * sync (fase 2, `src/domain/noteMerge.ts`) - aqui é só a listagem para a
 * pessoa restaurar.
 */
export function useDeletedNotes(): readonly Note[] {
  const all = useAllNotes()
  return useMemo(
    () =>
      all
        .filter((note) => note.deleted)
        .toSorted((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
    [all],
  )
}

/** Todas as tags em uso, únicas, em ordem alfabética - para o filtro por tag da lista. */
export function useNoteTags(): readonly string[] {
  const notes = useNotes()
  return useMemo(() => {
    const seen = new Set<string>()
    for (const note of notes) {
      for (const tag of note.tags) seen.add(tag)
    }
    return [...seen].toSorted((a, b) => a.localeCompare(b))
  }, [notes])
}
