import { describe, expect, it } from 'vitest'
import { createTask } from './task.ts'
import { archiveTask, editTaskFields, restoreTask, sortTasksForQuadrant } from './taskLifecycle.ts'
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

function taskWith(id: string, position: number, date: string | null): Task {
  return { ...createTask(newTaskInput({ id, position }), NOW).task, date }
}

describe('archiveTask', () => {
  const q4Task: Task = createTask(newTaskInput({ quadrant: 'q4' }), NOW).task

  it('arquiva uma tarefa aberta de q4, gerando o evento "archived"', () => {
    const { task: archived, event } = archiveTask(
      q4Task,
      { eventId: 'event-10', device: 'pc empresa' },
      LATER,
    )

    expect(archived.status).toBe('archived')
    expect(archived.updated_at).toBe(LATER)
    expect(archived.quadrant).toBe('q4')
    expect(event).toMatchObject({
      type: 'archived',
      from_quadrant: 'q4',
      to_quadrant: 'q4',
      device: 'pc empresa',
    })
  })

  it('recusa arquivar fora de q4', () => {
    const q1Task: Task = createTask(newTaskInput({ quadrant: 'q1' }), NOW).task
    expect(() =>
      archiveTask(q1Task, { eventId: 'event-11', device: 'celular' }, LATER),
    ).toThrow()
  })

  it('recusa arquivar uma tarefa que nao esta aberta', () => {
    const { task: archived } = archiveTask(
      q4Task,
      { eventId: 'event-10', device: 'pc empresa' },
      LATER,
    )
    expect(() =>
      archiveTask(archived, { eventId: 'event-12', device: 'celular' }, LATER),
    ).toThrow()
  })
})

describe('restoreTask', () => {
  const q4Task: Task = createTask(newTaskInput({ quadrant: 'q4' }), NOW).task
  const archived: Task = archiveTask(
    q4Task,
    { eventId: 'event-10', device: 'pc empresa' },
    LATER,
  ).task

  it('restaura uma tarefa arquivada para aberta, no quadrante escolhido', () => {
    const { task: restored, event } = restoreTask(
      archived,
      'q2',
      500,
      { eventId: 'event-13', device: 'celular' },
      '2026-10-15T10:10:00.000Z',
    )

    expect(restored.status).toBe('open')
    expect(restored.quadrant).toBe('q2')
    expect(restored.position).toBe(500)
    expect(restored.completed_at).toBeNull()
    expect(event).toMatchObject({
      type: 'reopened',
      from_quadrant: 'q4',
      to_quadrant: 'q2',
    })
  })

  it('aceita restaurar de volta para a caixa de entrada', () => {
    const { task: restored } = restoreTask(
      archived,
      null,
      500,
      { eventId: 'event-14', device: 'celular' },
      LATER,
    )
    expect(restored.quadrant).toBeNull()
  })

  it('recusa restaurar uma tarefa que ja esta aberta', () => {
    expect(() =>
      restoreTask(q4Task, 'q1', 500, { eventId: 'event-15', device: 'celular' }, LATER),
    ).toThrow()
  })
})

describe('editTaskFields', () => {
  const task: Task = createTask(newTaskInput(), NOW).task

  it('atualiza so os campos informados, mantendo o resto', () => {
    const edited = editTaskFields(
      task,
      { notes: 'Ver anexo do e-mail.', date: '2026-10-20' },
      'celular',
      LATER,
    )

    expect(edited.notes).toBe('Ver anexo do e-mail.')
    expect(edited.date).toBe('2026-10-20')
    expect(edited.title).toBe(task.title)
    expect(edited.updated_at).toBe(LATER)
    expect(edited.device).toBe('celular')
  })

  it('remove espacos nas pontas ao editar o titulo', () => {
    const edited = editTaskFields(task, { title: '  Novo titulo  ' }, 'celular', LATER)
    expect(edited.title).toBe('Novo titulo')
  })

  it('recusa titulo vazio', () => {
    expect(() => editTaskFields(task, { title: '   ' }, 'celular', LATER)).toThrow()
  })

  it('aceita limpar um campo de volta para null', () => {
    const withNotes = editTaskFields(task, { notes: 'Algo' }, 'celular', LATER)
    const cleared = editTaskFields(withNotes, { notes: null }, 'celular', LATER)
    expect(cleared.notes).toBeNull()
  })

  it('substitui as tags por copia nova, nao referencia a entrada', () => {
    const tags = ['fornecedor']
    const edited = editTaskFields(task, { tags }, 'celular', LATER)
    expect(edited.tags).toEqual(['fornecedor'])
    expect(edited.tags).not.toBe(tags)
  })
})

describe('sortTasksForQuadrant', () => {
  it('fora de q2, ordena so pela posicao, ignorando data', () => {
    const a = taskWith('a', 300, '2026-10-20')
    const b = taskWith('b', 100, null)
    const c = taskWith('c', 200, '2026-10-10')

    expect(sortTasksForQuadrant([a, b, c], 'q1').map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('em q2, ordena por data crescente, data mais proxima primeiro', () => {
    const a = taskWith('a', 100, '2026-10-20')
    const b = taskWith('b', 200, '2026-10-10')

    expect(sortTasksForQuadrant([a, b], 'q2').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('em q2, tarefas sem data ficam no fim', () => {
    const comData = taskWith('com-data', 500, '2026-10-20')
    const semData = taskWith('sem-data', 100, null)

    expect(sortTasksForQuadrant([semData, comData], 'q2').map((t) => t.id)).toEqual([
      'com-data',
      'sem-data',
    ])
  })

  it('em q2, empate de data desempata pela posicao', () => {
    const primeira = taskWith('primeira', 100, '2026-10-20')
    const segunda = taskWith('segunda', 200, '2026-10-20')

    expect(sortTasksForQuadrant([segunda, primeira], 'q2').map((t) => t.id)).toEqual([
      'primeira',
      'segunda',
    ])
  })
})
