/**
 * Teste de integracao contra um IndexedDB de mentira - mesmo padrao de
 * `src/db/tasksRepo.test.ts`: cobre a fiacao real do Dexie que um teste de
 * dominio puro (`src/domain/note.test.ts`) nao alcança.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getMeta } from './metaRepo.ts'
import { MatrizDB } from './schema.ts'
import {
  NoteNotFoundError,
  createNoteWithContent,
  deleteNoteById,
  editNoteFields,
  restoreNoteById,
} from './notesRepo.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-notas-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('createNoteWithContent', () => {
  it('grava a anotacao e marca pendente', async () => {
    const note = await createNoteWithContent(db, 'note-1', 'Reunião com #fornecedor', null, 'pc empresa')

    expect(note).toMatchObject({
      id: 'note-1',
      title: null,
      body: 'Reunião com #fornecedor',
      tags: ['fornecedor'],
      deleted: false,
      device: 'pc empresa',
    })

    const stored = await db.notes.get('note-1')
    expect(stored).toEqual(note)

    const meta = await getMeta(db)
    expect(meta.pending_ids).toContain('note-1')
  })

  it('aceita titulo', async () => {
    const note = await createNoteWithContent(db, 'note-1', 'corpo', 'Título da reunião', 'pc')
    expect(note.title).toBe('Título da reunião')
  })
})

describe('editNoteFields', () => {
  it('atualiza o corpo, recalcula tags, marca pendente de novo', async () => {
    const note = await createNoteWithContent(db, 'note-1', 'corpo original', null, 'pc')
    const edited = await editNoteFields(db, 'note-1', { body: 'novo corpo #urgente' }, 'celular')

    expect(edited.body).toBe('novo corpo #urgente')
    expect(edited.tags).toEqual(['urgente'])
    expect(edited.created_at).toBe(note.created_at)
    expect(edited.device).toBe('celular')

    const meta = await getMeta(db)
    expect(meta.pending_ids).toContain('note-1')
  })

  it('lanca NoteNotFoundError para id inexistente', async () => {
    await expect(editNoteFields(db, 'inexistente', { body: 'x' })).rejects.toThrow(NoteNotFoundError)
  })
})

describe('deleteNoteById / restoreNoteById', () => {
  it('exclusao logica: a anotacao continua no banco, so marcada', async () => {
    await createNoteWithContent(db, 'note-1', 'corpo', null, 'pc')
    const deleted = await deleteNoteById(db, 'note-1', 'celular')

    expect(deleted.deleted).toBe(true)
    expect(deleted.deleted_at).not.toBeNull()

    const stored = await db.notes.get('note-1')
    expect(stored?.deleted).toBe(true)
  })

  it('restaurar limpa deleted e deleted_at', async () => {
    await createNoteWithContent(db, 'note-1', 'corpo', null, 'pc')
    await deleteNoteById(db, 'note-1', 'pc')
    const restored = await restoreNoteById(db, 'note-1', 'pc')

    expect(restored.deleted).toBe(false)
    expect(restored.deleted_at).toBeNull()
  })
})
