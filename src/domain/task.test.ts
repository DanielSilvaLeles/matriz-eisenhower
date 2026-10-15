import { describe, expect, it } from 'vitest'
import { completeTask, createTask, moveTask, reopenTask, reorderTask } from './task.ts'
import type { Task } from './schema.ts'

const NOW = '2026-10-15T10:00:00.000Z'
const LATER = '2026-10-15T10:05:00.000Z'

function newTaskInput(overrides: Partial<Parameters<typeof createTask>[0]> = {}) {
  return {
    id: 'task-1',
    eventId: 'event-1',
    title: 'Revisar PR do time',
    quadrant: 'q1' as const,
    position: 1000,
    device: 'pc empresa',
    ...overrides,
  }
}

describe('createTask', () => {
  it('cria a tarefa aberta, no quadrante pedido, com os padroes certos', () => {
    const { task } = createTask(newTaskInput(), NOW)

    expect(task).toMatchObject({
      id: 'task-1',
      title: 'Revisar PR do time',
      quadrant: 'q1',
      status: 'open',
      position: 1000,
      date: null,
      tags: [],
      source: 'web',
      context: 'work',
      deleted: false,
      device: 'pc empresa',
    })
    expect(task.created_at).toBe(NOW)
    expect(task.updated_at).toBe(NOW)
    expect(task.completed_at).toBeNull()
  })

  it('remove espacos nas pontas do titulo', () => {
    const { task } = createTask(newTaskInput({ title: '  Com espaco  ' }), NOW)
    expect(task.title).toBe('Com espaco')
  })

  it('recusa titulo vazio ou so com espacos', () => {
    expect(() => createTask(newTaskInput({ title: '' }), NOW)).toThrow()
    expect(() => createTask(newTaskInput({ title: '   ' }), NOW)).toThrow()
  })

  it('aceita quadrante nulo, para quando a caixa de entrada existir', () => {
    const { task } = createTask(newTaskInput({ quadrant: null }), NOW)
    expect(task.quadrant).toBeNull()
  })

  it('respeita source e context quando informados', () => {
    const { task } = createTask(
      newTaskInput({ source: 'pwa', context: 'personal' }),
      NOW,
    )
    expect(task.source).toBe('pwa')
    expect(task.context).toBe('personal')
  })

  it('gera um evento "created" com o quadrante de destino', () => {
    const { event } = createTask(newTaskInput(), NOW)
    expect(event).toMatchObject({
      id: 'event-1',
      task_id: 'task-1',
      type: 'created',
      from_quadrant: null,
      to_quadrant: 'q1',
      at: NOW,
      device: 'pc empresa',
    })
  })
})

describe('moveTask', () => {
  const task: Task = createTask(newTaskInput(), NOW).task

  it('troca o quadrante, a posicao e marca o aparelho que agiu', () => {
    const { task: moved } = moveTask(
      task,
      'q2',
      2000,
      { eventId: 'event-2', device: 'celular' },
      LATER,
    )

    expect(moved.quadrant).toBe('q2')
    expect(moved.position).toBe(2000)
    expect(moved.updated_at).toBe(LATER)
    expect(moved.device).toBe('celular')
    // O resto da tarefa fica intacto.
    expect(moved.title).toBe(task.title)
    expect(moved.created_at).toBe(task.created_at)
  })

  it('gera um evento "moved" com origem e destino', () => {
    const { event } = moveTask(
      task,
      'q3',
      3000,
      { eventId: 'event-3', device: 'celular' },
      LATER,
    )
    expect(event).toMatchObject({
      type: 'moved',
      from_quadrant: 'q1',
      to_quadrant: 'q3',
      at: LATER,
      device: 'celular',
    })
  })

  it('recusa mover para o mesmo quadrante em que ja esta', () => {
    expect(() =>
      moveTask(task, 'q1', 1500, { eventId: 'event-4', device: 'celular' }, LATER),
    ).toThrow()
  })

  it('aceita devolver para a caixa de entrada (quadrante nulo)', () => {
    const { task: backToInbox, event } = moveTask(
      task,
      null,
      500,
      { eventId: 'event-9', device: 'celular' },
      LATER,
    )
    expect(backToInbox.quadrant).toBeNull()
    expect(event).toMatchObject({ from_quadrant: 'q1', to_quadrant: null })
  })
})

describe('reorderTask', () => {
  const task: Task = createTask(newTaskInput(), NOW).task

  it('troca so a posicao e o aparelho, sem gerar evento', () => {
    const reordered = reorderTask(task, 5000, 'celular', LATER)

    expect(reordered.position).toBe(5000)
    expect(reordered.device).toBe('celular')
    expect(reordered.updated_at).toBe(LATER)
    // Nada mais muda.
    expect(reordered.quadrant).toBe(task.quadrant)
    expect(reordered.title).toBe(task.title)
  })
})

describe('completeTask e reopenTask', () => {
  const open: Task = createTask(newTaskInput(), NOW).task

  it('conclui uma tarefa aberta: risca, registra completed_at e o aparelho', () => {
    const { task: done, event } = completeTask(
      open,
      { eventId: 'event-5', device: 'pc empresa' },
      LATER,
    )

    expect(done.status).toBe('done')
    expect(done.completed_at).toBe(LATER)
    expect(done.updated_at).toBe(LATER)
    expect(done.quadrant).toBe('q1')
    expect(event).toMatchObject({
      type: 'completed',
      from_quadrant: 'q1',
      to_quadrant: 'q1',
      device: 'pc empresa',
    })
  })

  it('recusa concluir uma tarefa que ja esta concluida', () => {
    const { task: done } = completeTask(
      open,
      { eventId: 'event-5', device: 'pc empresa' },
      LATER,
    )
    expect(() =>
      completeTask(done, { eventId: 'event-6', device: 'pc empresa' }, LATER),
    ).toThrow()
  })

  it('reabre uma tarefa concluida: volta para aberta, sem completed_at', () => {
    const { task: done } = completeTask(
      open,
      { eventId: 'event-5', device: 'pc empresa' },
      LATER,
    )
    const { task: reopened, event } = reopenTask(
      done,
      { eventId: 'event-7', device: 'celular' },
      '2026-10-15T10:10:00.000Z',
    )

    expect(reopened.status).toBe('open')
    expect(reopened.completed_at).toBeNull()
    expect(reopened.device).toBe('celular')
    expect(event.type).toBe('reopened')
  })

  it('recusa reabrir uma tarefa que ainda esta aberta', () => {
    expect(() =>
      reopenTask(open, { eventId: 'event-8', device: 'celular' }, LATER),
    ).toThrow()
  })
})
