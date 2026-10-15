import { describe, expect, it } from 'vitest'
import { reorderPosition } from './reorderPosition.ts'
import { createTask } from '@/domain/task.ts'
import type { Task } from '@/domain/schema.ts'

function task(id: string, position: number): Task {
  return createTask(
    { id, eventId: `event-${id}`, title: `Tarefa ${id}`, quadrant: 'q1', position, device: 'pc' },
    '2026-10-15T10:00:00.000Z',
  ).task
}

describe('reorderPosition', () => {
  it('move a primeira tarefa para depois da ultima', () => {
    const list = [task('a', 1000), task('b', 2000), task('c', 3000)]
    const position = reorderPosition(list, 'a', 'c')

    // "a" deve ficar depois de "c" (3000) - unica vizinha a direita e nenhuma a esquerda.
    expect(position).toBeGreaterThan(3000)
  })

  it('move a ultima tarefa para antes da primeira', () => {
    const list = [task('a', 1000), task('b', 2000), task('c', 3000)]
    const position = reorderPosition(list, 'c', 'a')

    expect(position).toBeLessThan(1000)
  })

  it('move a tarefa do meio para o indice da ultima: vira a nova ultima', () => {
    const list = [task('a', 1000), task('b', 2000), task('c', 3000), task('d', 4000)]
    // arrayMove poe "b" exatamente no indice de "d" (3): c e d deslizam uma
    // posicao para tras, e "b" vira a nova ultima da lista - nao fica entre
    // c e d. E o mesmo comportamento de qualquer lista arrastavel padrao:
    // soltar sobre o ultimo item manda para o fim.
    const position = reorderPosition(list, 'b', 'd')

    expect(position).toBeGreaterThan(4000)
  })

  it('ids desconhecidos: cai para o fim da lista, sem travar', () => {
    const list = [task('a', 1000), task('b', 2000)]
    const position = reorderPosition(list, 'inexistente', 'tambem-inexistente')
    expect(position).toBeGreaterThan(2000)
  })

  it('lista vazia: nao trava, devolve uma posicao inicial', () => {
    expect(() => reorderPosition([], 'a', 'b')).not.toThrow()
  })
})
