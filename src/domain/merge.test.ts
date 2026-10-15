import { describe, expect, it } from 'vitest'
import { mergeState, type SyncableState } from './merge.ts'
import type { Person, Task, TaskEvent } from './schema.ts'

const NOW = '2026-10-15T12:00:00.000Z'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Revisar PR do time',
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
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
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
    type: 'created',
    from_quadrant: null,
    to_quadrant: 'q1',
    at: '2026-10-01T08:00:00.000Z',
    device: 'pc empresa',
    ...overrides,
  }
}

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    name: 'Fulano',
    updated_at: '2026-10-01T08:00:00.000Z',
    ...overrides,
  }
}

function state(overrides: Partial<SyncableState> = {}): SyncableState {
  return { tasks: [], taskEvents: [], people: [], ...overrides }
}

describe('mergeState', () => {
  it('edicao em dois aparelhos: vence o updated_at mais recente', () => {
    const doCelular = task({
      title: 'Titulo editado no celular',
      updated_at: '2026-10-15T09:00:00.000Z',
      device: 'celular',
    })
    const doPc = task({
      title: 'Titulo editado no pc, antes',
      updated_at: '2026-10-15T08:00:00.000Z',
      device: 'pc empresa',
    })

    const resultado = mergeState(state({ tasks: [doPc] }), state({ tasks: [doCelular] }), NOW)

    expect(resultado.tasks).toHaveLength(1)
    expect(resultado.tasks[0]?.title).toBe('Titulo editado no celular')
  })

  it('exclusao vs edicao: a exclusao mais recente vence e a tarefa fica apagada', () => {
    const editadaAntes = task({
      title: 'Ainda aberta',
      deleted: false,
      updated_at: '2026-10-15T08:00:00.000Z',
      device: 'pc empresa',
    })
    const apagadaDepois = task({
      deleted: true,
      updated_at: '2026-10-15T09:00:00.000Z',
      device: 'celular',
    })

    const resultado = mergeState(
      state({ tasks: [editadaAntes] }),
      state({ tasks: [apagadaDepois] }),
      NOW,
    )

    expect(resultado.tasks[0]?.deleted).toBe(true)
  })

  it('empate no updated_at: desempata pelo nome do aparelho, de forma deterministica', () => {
    const deA = task({ title: 'Do aparelho A', updated_at: NOW, device: 'aaa' })
    const deZ = task({ title: 'Do aparelho Z', updated_at: NOW, device: 'zzz' })

    // "zzz" > "aaa" em ordem alfabetica - o resultado nao pode depender de
    // qual lado cada tarefa entrou.
    const resultado1 = mergeState(state({ tasks: [deA] }), state({ tasks: [deZ] }), NOW)
    const resultado2 = mergeState(state({ tasks: [deZ] }), state({ tasks: [deA] }), NOW)

    expect(resultado1.tasks[0]?.device).toBe('zzz')
    expect(resultado2.tasks[0]?.device).toBe('zzz')
  })

  it('ressurreicao: uma edicao antiga nunca traz de volta uma tarefa ja apagada', () => {
    // O aparelho que apagou nunca viu a edicao antiga (ela e mais velha que
    // a propria exclusao) - mas isso nao pode importar: so o updated_at conta.
    const edicaoAntiga = task({
      title: 'Versao de antes de ser apagada',
      deleted: false,
      updated_at: '2026-09-01T00:00:00.000Z',
    })
    const exclusaoRecente = task({
      deleted: true,
      updated_at: '2026-10-10T00:00:00.000Z',
    })

    const resultado = mergeState(
      state({ tasks: [edicaoAntiga] }),
      state({ tasks: [exclusaoRecente] }),
      NOW,
    )

    expect(resultado.tasks[0]?.deleted).toBe(true)
  })

  it('idempotencia: mesclar o resultado consigo mesmo nao muda nada', () => {
    const a = state({
      tasks: [task({ id: 't1' }), task({ id: 't2', updated_at: '2026-10-02T00:00:00.000Z' })],
      taskEvents: [event({ id: 'e1' })],
      people: [person({ id: 'p1' })],
    })
    const b = state({
      tasks: [task({ id: 't2', updated_at: '2026-10-02T00:00:00.000Z' }), task({ id: 't3' })],
      taskEvents: [event({ id: 'e2' })],
      people: [person({ id: 'p2' })],
    })

    const primeiraMesclagem = mergeState(a, b, NOW)
    const segundaMesclagem = mergeState(primeiraMesclagem, primeiraMesclagem, NOW)

    expect(ordenado(segundaMesclagem.tasks)).toEqual(ordenado(primeiraMesclagem.tasks))
    expect(ordenado(segundaMesclagem.taskEvents)).toEqual(ordenado(primeiraMesclagem.taskEvents))
    expect(ordenado(segundaMesclagem.people)).toEqual(ordenado(primeiraMesclagem.people))
  })

  it('comutatividade: a ordem dos aparelhos nao muda o resultado', () => {
    const a = state({
      tasks: [
        task({ id: 't1', title: 'Versao A', updated_at: '2026-10-15T09:00:00.000Z' }),
        task({ id: 't2' }),
      ],
      taskEvents: [event({ id: 'e1' })],
      people: [person({ id: 'p1' })],
    })
    const b = state({
      tasks: [
        task({ id: 't1', title: 'Versao B', updated_at: '2026-10-15T08:00:00.000Z' }),
        task({ id: 't3' }),
      ],
      taskEvents: [event({ id: 'e2' })],
      people: [person({ id: 'p2' })],
    })

    const aAntesDeB = mergeState(a, b, NOW)
    const bAntesDeA = mergeState(b, a, NOW)

    expect(ordenado(aAntesDeB.tasks)).toEqual(ordenado(bAntesDeA.tasks))
    expect(ordenado(aAntesDeB.taskEvents)).toEqual(ordenado(bAntesDeA.taskEvents))
    expect(ordenado(aAntesDeB.people)).toEqual(ordenado(bAntesDeA.people))
  })

  it('tombstones com mais de 30 dias somem da mesclagem', () => {
    // Mais de 30 dias antes de NOW.
    const tombstoneVelho = task({ deleted: true, updated_at: '2026-08-01T00:00:00.000Z' })
    // Menos de 30 dias antes de NOW.
    const tombstoneRecente = task({
      id: 'task-2',
      deleted: true,
      updated_at: '2026-10-10T00:00:00.000Z',
    })

    const resultado = mergeState(
      state({ tasks: [tombstoneVelho, tombstoneRecente] }),
      state(),
      NOW,
    )

    expect(resultado.tasks.map((t) => t.id)).toEqual(['task-2'])
  })

  it('tarefas, eventos e pessoas sem conflito so se somam (uniao)', () => {
    const a = state({ tasks: [task({ id: 't1' })], people: [person({ id: 'p1' })] })
    const b = state({ tasks: [task({ id: 't2' })], people: [person({ id: 'p2' })] })

    const resultado = mergeState(a, b, NOW)

    expect(resultado.tasks.map((t) => t.id).toSorted()).toEqual(['t1', 't2'])
    expect(resultado.people.map((p) => p.id).toSorted()).toEqual(['p1', 'p2'])
  })
})

function ordenado<T extends { id: string }>(items: readonly T[]): T[] {
  return items.toSorted((a, b) => a.id.localeCompare(b.id))
}
