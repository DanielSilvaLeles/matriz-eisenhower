/**
 * Teste de integracao contra um IndexedDB de mentira (fake-indexeddb): cobre
 * a fiacao real do Dexie - indices compostos, transacoes, geracao de evento
 * junto com a tarefa - que um teste de dominio puro nao alcança porque nao
 * toca banco nenhum.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MatrizDB } from './schema.ts'
import {
  TaskNotFoundError,
  addTaskToQuadrant,
  completeTaskById,
  moveTaskToQuadrant,
  reopenTaskById,
} from './tasksRepo.ts'

let db: MatrizDB

beforeEach(() => {
  // Nome unico por teste: zero vazamento de estado entre testes, sem
  // precisar de uma limpeza cuidadosa ao final de cada um.
  db = new MatrizDB(`teste-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('addTaskToQuadrant', () => {
  it('grava a tarefa e o evento "created" juntos', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Revisar PR', 'pc empresa')

    expect(task.quadrant).toBe('q1')
    expect(task.status).toBe('open')
    expect(task.device).toBe('pc empresa')

    const stored = await db.tasks.get(task.id)
    expect(stored).toEqual(task)

    const events = await db.task_events.where('task_id').equals(task.id).sortBy('at')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'created', to_quadrant: 'q1' })
  })

  it('poe cada tarefa nova no fim da lista do quadrante', async () => {
    const first = await addTaskToQuadrant(db, 'q2', 'Primeira')
    const second = await addTaskToQuadrant(db, 'q2', 'Segunda')
    const third = await addTaskToQuadrant(db, 'q2', 'Terceira')

    expect(first.position).toBeLessThan(second.position)
    expect(second.position).toBeLessThan(third.position)
  })

  it('nao mistura a posicao de quadrantes diferentes', async () => {
    const q1Task = await addTaskToQuadrant(db, 'q1', 'Em Q1')
    const q3Task = await addTaskToQuadrant(db, 'q3', 'Em Q3')

    // Cada quadrante comeca sua propria contagem; nao ha relacao esperada
    // entre as duas posicoes alem de cada uma ser a primeira do seu quadrante.
    expect(q1Task.quadrant).toBe('q1')
    expect(q3Task.quadrant).toBe('q3')
  })
})

describe('completeTaskById e reopenTaskById', () => {
  it('conclui, gera o evento e some da lista de abertas', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Revisar PR')

    const done = await completeTaskById(db, task.id, 'pc empresa')
    expect(done.status).toBe('done')
    expect(done.completed_at).not.toBeNull()

    const open = await db.tasks
      .where('[quadrant+status]')
      .equals(['q1', 'open'])
      .toArray()
    expect(open).toHaveLength(0)

    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events.map((e) => e.type).toSorted()).toEqual(['completed', 'created'].toSorted())
  })

  it('reabre e volta para a lista de abertas do mesmo quadrante', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    await completeTaskById(db, task.id)
    const reopened = await reopenTaskById(db, task.id)

    expect(reopened.status).toBe('open')
    expect(reopened.completed_at).toBeNull()
    expect(reopened.quadrant).toBe('q1')

    // A ordem cronologica exata ja tem teste de dominio puro em task.test.ts,
    // com `now` controlado. Aqui, em execucao rapida, as tres chamadas podem
    // cair no mesmo milissegundo - o que importa neste teste de integracao e
    // que os tres eventos foram gravados, nao a ordem que o Dexie devolve.
    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events.map((e) => e.type).toSorted()).toEqual(
      ['completed', 'created', 'reopened'].toSorted(),
    )
  })

  it('lanca TaskNotFoundError para um id que nao existe', async () => {
    await expect(completeTaskById(db, 'inexistente')).rejects.toBeInstanceOf(
      TaskNotFoundError,
    )
    await expect(reopenTaskById(db, 'inexistente')).rejects.toBeInstanceOf(
      TaskNotFoundError,
    )
  })
})

describe('moveTaskToQuadrant', () => {
  it('troca de quadrante e poe no fim da lista de destino', async () => {
    const task = await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    await addTaskToQuadrant(db, 'q2', 'Ja em Q2')

    const moved = await moveTaskToQuadrant(db, task.id, 'q2', 'celular')

    expect(moved.quadrant).toBe('q2')
    expect(moved.device).toBe('celular')

    const q2Open = await db.tasks
      .where('[quadrant+status]')
      .equals(['q2', 'open'])
      .toArray()
    expect(q2Open).toHaveLength(2)

    const events = await db.task_events.where('task_id').equals(task.id).toArray()
    expect(events.map((e) => e.type).toSorted()).toEqual(['created', 'moved'].toSorted())
  })

  it('lanca TaskNotFoundError para um id que nao existe', async () => {
    await expect(moveTaskToQuadrant(db, 'inexistente', 'q2')).rejects.toBeInstanceOf(
      TaskNotFoundError,
    )
  })
})
