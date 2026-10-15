import { describe, expect, it } from 'vitest'
import { computeWeeklyReview, formatInboxDuration } from './weeklyReview.ts'
import type { Task, TaskEvent } from './schema.ts'

// Segunda-feira.
const WEEK_START = '2026-10-12T00:00:00.000Z'
const BEFORE_WEEK = '2026-10-10T12:00:00.000Z'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    notes: null,
    quadrant: 'q1',
    status: 'open',
    position: 1000,
    date: null,
    delegated_to: null,
    delegation_context: null,
    expected_outcome: null,
    tags: [],
    source: 'web',
    context: 'work',
    created_at: '2026-10-12T09:00:00.000Z',
    updated_at: '2026-10-12T09:00:00.000Z',
    completed_at: null,
    deleted: false,
    device: 'pc empresa',
    ...overrides,
  }
}

function event(overrides: Partial<TaskEvent> = {}): TaskEvent {
  return {
    id: 'event-1',
    task_id: 'task-1',
    type: 'moved',
    from_quadrant: null,
    to_quadrant: 'q1',
    at: '2026-10-12T10:00:00.000Z',
    device: 'pc empresa',
    ...overrides,
  }
}

describe('computeWeeklyReview', () => {
  it('conta concluidas por quadrante so desta semana', () => {
    const tasks = [
      task({ id: 'a', quadrant: 'q1', status: 'done', completed_at: '2026-10-13T10:00:00.000Z' }),
      task({ id: 'b', quadrant: 'q1', status: 'done', completed_at: '2026-10-14T10:00:00.000Z' }),
      task({ id: 'c', quadrant: 'q2', status: 'done', completed_at: '2026-10-13T10:00:00.000Z' }),
      // Concluida antes do inicio da semana: nao conta.
      task({ id: 'd', quadrant: 'q1', status: 'done', completed_at: BEFORE_WEEK }),
      // Ainda aberta: nao conta.
      task({ id: 'e', quadrant: 'q3', status: 'open' }),
    ]

    const stats = computeWeeklyReview(tasks, [], WEEK_START)

    expect(stats.completedByQuadrant).toEqual({ q1: 2, q2: 1, q3: 0, q4: 0 })
  })

  it('conta tarefas que chegaram em Q1 vindas de Q2 com a data vencida', () => {
    const tasks = [
      task({ id: 'atrasada', quadrant: 'q1', date: '2026-10-10' }),
      task({ id: 'em-dia', quadrant: 'q1', date: '2026-10-20' }),
      task({ id: 'sem-data', quadrant: 'q1', date: null }),
    ]
    const events = [
      event({ task_id: 'atrasada', from_quadrant: 'q2', to_quadrant: 'q1', at: '2026-10-13T10:00:00.000Z' }),
      event({ task_id: 'em-dia', from_quadrant: 'q2', to_quadrant: 'q1', at: '2026-10-13T10:00:00.000Z' }),
      event({ task_id: 'sem-data', from_quadrant: 'q2', to_quadrant: 'q1', at: '2026-10-13T10:00:00.000Z' }),
      // Movimento de Q3 para Q1 nao conta - so Q2 para Q1.
      event({ task_id: 'atrasada', from_quadrant: 'q3', to_quadrant: 'q1', at: '2026-10-13T10:00:00.000Z' }),
    ]

    const stats = computeWeeklyReview(tasks, events, WEEK_START)

    expect(stats.cameFromOverdueQ2ToQ1).toBe(1)
  })

  it('ignora movimentos Q2->Q1 de antes desta semana', () => {
    const tasks = [task({ id: 'a', quadrant: 'q1', date: '2026-10-01' })]
    const events = [
      event({ task_id: 'a', from_quadrant: 'q2', to_quadrant: 'q1', at: BEFORE_WEEK }),
    ]

    expect(computeWeeklyReview(tasks, events, WEEK_START).cameFromOverdueQ2ToQ1).toBe(0)
  })

  it('calcula o tempo medio parado na caixa de entrada, so de quem saiu dela esta semana', () => {
    const tasks = [
      task({ id: 'a', created_at: '2026-10-12T08:00:00.000Z' }),
      task({ id: 'b', created_at: '2026-10-12T08:00:00.000Z' }),
    ]
    const events = [
      // 'a': 2 horas na caixa (120 min).
      event({ task_id: 'a', from_quadrant: null, to_quadrant: 'q1', at: '2026-10-12T10:00:00.000Z' }),
      // 'b': 4 horas na caixa (240 min).
      event({ task_id: 'b', from_quadrant: null, to_quadrant: 'q2', at: '2026-10-12T12:00:00.000Z' }),
      // Nao sai da caixa (from_quadrant nao e null): nao entra na media.
      event({ task_id: 'a', from_quadrant: 'q1', to_quadrant: 'q2', at: '2026-10-13T10:00:00.000Z' }),
    ]

    const stats = computeWeeklyReview(tasks, events, WEEK_START)

    // Media de 120 e 240.
    expect(stats.averageInboxMinutes).toBe(180)
  })

  it('tempo medio e null quando nada saiu da caixa de entrada esta semana', () => {
    const stats = computeWeeklyReview([], [], WEEK_START)
    expect(stats.averageInboxMinutes).toBeNull()
  })

  it('conta eliminadas (arquivadas) so desta semana', () => {
    const events = [
      event({ type: 'archived', at: '2026-10-13T10:00:00.000Z' }),
      event({ type: 'archived', at: '2026-10-14T10:00:00.000Z' }),
      event({ type: 'archived', at: BEFORE_WEEK }),
    ]

    expect(computeWeeklyReview([], events, WEEK_START).eliminatedCount).toBe(2)
  })

  it('devolve tudo zerado/null sem tarefas nem eventos', () => {
    const stats = computeWeeklyReview([], [], WEEK_START)
    expect(stats).toEqual({
      completedByQuadrant: { q1: 0, q2: 0, q3: 0, q4: 0 },
      cameFromOverdueQ2ToQ1: 0,
      averageInboxMinutes: null,
      eliminatedCount: 0,
    })
  })
})

describe('formatInboxDuration', () => {
  it('so minutos, quando menos de uma hora', () => {
    expect(formatInboxDuration(45)).toBe('45min')
  })

  it('horas exatas, sem minutos sobrando', () => {
    expect(formatInboxDuration(120)).toBe('2h')
  })

  it('horas e minutos', () => {
    expect(formatInboxDuration(135)).toBe('2h 15min')
  })

  it('arredonda fracoes de minuto', () => {
    expect(formatInboxDuration(90.6)).toBe('1h 31min')
  })
})
