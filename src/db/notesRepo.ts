/**
 * Repositório de anotações - mesmo padrão de `src/db/tasksRepo.ts`: a
 * camada que mistura o domínio puro (`src/domain/note.ts`) com efeito
 * colateral (Dexie, relógio, geração de id). Cada função é uma transação
 * e marca a anotação como pendente de confirmação, na MESMA lista
 * `meta.pending_ids` que as tarefas já usam - o contador de pendências e o
 * botão "Sincronizar agora" passam a cobrir os dois tipos juntos
 * (`docs/prompt-anotacoes.md` seção 6.3), sem precisar de uma segunda
 * lista: ids são UUIDs, não colidem entre tarefa e anotação.
 */
import { createNote, deleteNote, editNote, restoreNote, type NoteFieldEdits } from '@/domain/note.ts'
import type { Note } from '@/domain/schema.ts'
import { notifyLocalWrite } from './changeSignal.ts'
import { getDeviceName } from './device.ts'
import { markPendingInTx } from './metaRepo.ts'
import type { MatrizDB } from './schema.ts'

export class NoteNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Anotação não encontrada: ${noteId}`)
  }
}

function nowISO(): string {
  return new Date().toISOString()
}

async function getNoteOrThrow(db: MatrizDB, noteId: string): Promise<Note> {
  const note = await db.notes.get(noteId)
  if (!note) throw new NoteNotFoundError(noteId)
  return note
}

/**
 * Cria a anotação já com o corpo digitado - `docs/prompt-anotacoes.md`
 * seção 5: "a anotação só passa a existir quando eu digito o primeiro
 * caractere". Quem decide QUANDO chamar isso (corpo deixou de estar vazio)
 * é a UI (`src/ui/notes/NoteEditor.tsx`), não aqui - esta função já supõe
 * que `body` não é vazio (ver `createNote`, que lança se for).
 */
export function createNoteWithContent(
  db: MatrizDB,
  id: string,
  body: string,
  title: string | null = null,
  device: string = getDeviceName(),
): Promise<Note> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.meta, async () => {
    const note = createNote({ id, body, title, device }, nowISO())
    await db.notes.add(note)
    await markPendingInTx(db, note.id)
    return note
  })
}

/** Autosave e edição manual (título) passam pela mesma função - ver `src/ui/hooks/useDebouncedCallback.ts`. */
export function editNoteFields(
  db: MatrizDB,
  noteId: string,
  edits: NoteFieldEdits,
  device: string = getDeviceName(),
): Promise<Note> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.meta, async () => {
    const existing = await getNoteOrThrow(db, noteId)
    const updated = editNote(existing, edits, device, nowISO())
    await db.notes.put(updated)
    await markPendingInTx(db, updated.id)
    return updated
  })
}

/** Exclusão lógica - toast "Desfazer" chama `restoreNoteById` se a pessoa desfizer a tempo. */
export function deleteNoteById(
  db: MatrizDB,
  noteId: string,
  device: string = getDeviceName(),
): Promise<Note> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.meta, async () => {
    const existing = await getNoteOrThrow(db, noteId)
    const updated = deleteNote(existing, device, nowISO())
    await db.notes.put(updated)
    await markPendingInTx(db, updated.id)
    return updated
  })
}

/** Restaura da lixeira de 30 dias (seção 5) ou desfaz uma exclusão recente. */
export function restoreNoteById(
  db: MatrizDB,
  noteId: string,
  device: string = getDeviceName(),
): Promise<Note> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.meta, async () => {
    const existing = await getNoteOrThrow(db, noteId)
    const updated = restoreNote(existing, device, nowISO())
    await db.notes.put(updated)
    await markPendingInTx(db, updated.id)
    return updated
  })
}
