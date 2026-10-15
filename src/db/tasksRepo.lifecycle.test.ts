/**
 * editTaskFields, archiveTaskById, restoreTaskFromHistory - separado de
 * tasksRepo.test.ts so pelo limite de linhas do lint (mesma fixture de
 * banco, mesmo arquivo de origem até esta divisão).
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MatrizDB } from './schema.ts'
import { TaskNotFoundError, addTaskToQuadrant, completeTaskById } from './tasksRepo.ts'
import { archiveTaskById, editTaskFields, restoreTaskFromHistory } from './tasksRepo.lifecycle.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('editTaskFields', () => {
  it('grava os campos editados, sem gerar evento novo', async () => {
    const task = await addTaskToQuadrant(db, 'q3', 'Revisar proposta')

    const edited = await editTaskFields(db, task.id, {
      delegated_to: 'Ana',
      delegation_context: 'Fornecedor cobra resposta',
      date: '2026-10-20',
    })

    expect(edited.delegated_to).toBe('Ana')
    expect(edited.date).toBe('2026-10-20')

    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events).toHaveLength(1)
  })

  it('cria a pessoa em people quando delegated_to e informado', async () => {
    const task = await addTaskToQuadrant(db, 'q3', 'Revisar proposta')
    await editTaskFields(db, task.id, { delegated_to: 'Bruno' })

    const people = await db.people.toArray()
    expect(people.map((p) => p.name)).toContain('Bruno')
  })

  it('lanca TaskNotFoundError para um id que nao existe', async () => {
    await expect(editTaskFields(db, 'inexistente', { notes: 'x' })).rejects.toBeInstanceOf(
      TaskNotFoundError,
    )
  })
})

describe('archiveTaskById', () => {
  it('arquiva a tarefa e gera o evento "archived"', async () => {
    const task = await addTaskToQuadrant(db, 'q4', 'Reuniao sem pauta')

    const archived = await archiveTaskById(db, task.id)

    expect(archived.status).toBe('archived')
    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events.map((e) => e.type).toSorted()).toEqual(['archived', 'created'].toSorted())
  })
})

describe('restoreTaskFromHistory', () => {
  it('restaura uma tarefa arquivada para aberta, no quadrante escolhido', async () => {
    const task = await addTaskToQuadrant(db, 'q4', 'Reuniao sem pauta')
    await archiveTaskById(db, task.id)

    const restored = await restoreTaskFromHistory(db, task.id, 'q1')

    expect(restored.status).toBe('open')
    expect(restored.quadrant).toBe('q1')

    const q1Open = await db.tasks.where('[quadrant+status]').equals(['q1', 'open']).toArray()
    expect(q1Open.map((t) => t.id)).toContain(task.id)
  })

  it('restaura uma tarefa concluida de volta para a caixa de entrada', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    await completeTaskById(db, task.id)

    const restored = await restoreTaskFromHistory(db, task.id, null)

    expect(restored.status).toBe('open')
    expect(restored.quadrant).toBeNull()
  })

  it('lanca TaskNotFoundError para um id que nao existe', async () => {
    await expect(restoreTaskFromHistory(db, 'inexistente', 'q1')).rejects.toBeInstanceOf(
      TaskNotFoundError,
    )
  })
})
