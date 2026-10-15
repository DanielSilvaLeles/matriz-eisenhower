import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MatrizDB } from './schema.ts'
import { addTaskToQuadrant, moveTaskToQuadrant } from './tasksRepo.ts'
import { archiveStaleQ4Tasks } from './archiveQ4.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('archiveStaleQ4Tasks', () => {
  it('arquiva uma tarefa de q4 cujo updated_at e de um dia local anterior', async () => {
    const task = await addTaskToQuadrant(db, 'q4', 'Reuniao sem pauta')
    // addTaskToQuadrant grava com o instante real de agora - para simular
    // "ja esta em q4 desde ontem", sobrescreve updated_at direto no banco.
    await db.tasks.update(task.id, { updated_at: '2026-10-14T23:00:00.000Z' })

    const archivedCount = await archiveStaleQ4Tasks(db, '2026-10-15T09:00:00.000Z')

    expect(archivedCount).toBe(1)
    const stored = await db.tasks.get(task.id)
    expect(stored?.status).toBe('archived')
  })

  it('nao arquiva uma tarefa de q4 movida para la hoje mesmo', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Vai para eliminar')
    await moveTaskToQuadrant(db, task.id, 'q4')

    const archivedCount = await archiveStaleQ4Tasks(db, new Date().toISOString())

    expect(archivedCount).toBe(0)
    const stored = await db.tasks.get(task.id)
    expect(stored?.status).toBe('open')
  })

  it('nao toca tarefas abertas de outros quadrantes', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Fazer agora')
    await db.tasks.update(task.id, { updated_at: '2026-10-14T23:00:00.000Z' })

    const archivedCount = await archiveStaleQ4Tasks(db, '2026-10-15T09:00:00.000Z')

    expect(archivedCount).toBe(0)
    const stored = await db.tasks.get(task.id)
    expect(stored?.status).toBe('open')
  })

  it('gera o evento "archived" para cada tarefa arquivada', async () => {
    const task = await addTaskToQuadrant(db, 'q4', 'Reuniao sem pauta')
    await db.tasks.update(task.id, { updated_at: '2026-10-14T23:00:00.000Z' })

    await archiveStaleQ4Tasks(db, '2026-10-15T09:00:00.000Z')

    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events.map((e) => e.type).toSorted()).toEqual(['archived', 'created'].toSorted())
  })
})
