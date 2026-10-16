/**
 * Teste de integracao contra um IndexedDB de mentira, mesmo padrao de
 * `notesRepo.test.ts` - separado so pelo arquivo que esta logica mora
 * (ver `notesRepo.actionLines.ts`).
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getMeta } from './metaRepo.ts'
import { createNoteWithContent } from './notesRepo.ts'
import { ActionLineNotFoundError, sendActionLineToInbox } from './notesRepo.actionLines.ts'
import { MatrizDB } from './schema.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-notas-acao-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('sendActionLineToInbox', () => {
  it('cria a tarefa na caixa de entrada com source note e source_note_id', async () => {
    await createNoteWithContent(db, 'note-1', 'Reunião\n[ ] Cobrar proposta do fornecedor', null, 'pc')

    const task = await sendActionLineToInbox(db, 'note-1', 1, 'pc')

    expect(task.title).toBe('Cobrar proposta do fornecedor')
    expect(task.source).toBe('note')
    expect(task.source_note_id).toBe('note-1')
    expect(task.quadrant).toBeNull()

    const stored = await db.tasks.get(task.id)
    expect(stored).toEqual(task)
  })

  it('troca o marcador da linha por [→] na própria anotação', async () => {
    await createNoteWithContent(db, 'note-1', '[ ] Enviar contrato', null, 'pc')
    await sendActionLineToInbox(db, 'note-1', 0, 'pc')

    const note = await db.notes.get('note-1')
    expect(note?.body).toBe('[→] Enviar contrato')
  })

  it('marca a tarefa nova E a anotação editada como pendentes', async () => {
    await createNoteWithContent(db, 'note-1', '[ ] Linha de ação', null, 'pc')
    const task = await sendActionLineToInbox(db, 'note-1', 0, 'pc')

    const meta = await getMeta(db)
    expect(meta.pending_ids).toContain(task.id)
    expect(meta.pending_ids).toContain('note-1')
  })

  it('recusa enviar a mesma linha duas vezes (já marcada [→])', async () => {
    await createNoteWithContent(db, 'note-1', '[ ] Linha única', null, 'pc')
    await sendActionLineToInbox(db, 'note-1', 0, 'pc')

    await expect(sendActionLineToInbox(db, 'note-1', 0, 'pc')).rejects.toThrow(ActionLineNotFoundError)

    // Nenhuma tarefa duplicada foi criada pela segunda tentativa.
    expect(await db.tasks.count()).toBe(1)
  })

  it('lanca ActionLineNotFoundError para um indice que nao e linha de ação', async () => {
    await createNoteWithContent(db, 'note-1', 'Texto qualquer, sem marcador', null, 'pc')
    await expect(sendActionLineToInbox(db, 'note-1', 0, 'pc')).rejects.toThrow(ActionLineNotFoundError)
  })

  it('envia so a linha pedida quando há mais de uma linha de ação', async () => {
    await createNoteWithContent(db, 'note-1', '[ ] Primeira\n[ ] Segunda', null, 'pc')
    await sendActionLineToInbox(db, 'note-1', 1, 'pc')

    const note = await db.notes.get('note-1')
    expect(note?.body).toBe('[ ] Primeira\n[→] Segunda')
    expect(await db.tasks.count()).toBe(1)
  })
})
