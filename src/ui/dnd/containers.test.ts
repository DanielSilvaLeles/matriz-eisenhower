import { describe, expect, it } from 'vitest'
import { parseQuadrantContainerId, quadrantContainerId } from './containers.ts'
import { QUADRANTS } from '@/domain/quadrant.ts'

describe('quadrantContainerId / parseQuadrantContainerId', () => {
  it('gera e reconhece o id de cada quadrante (ida e volta)', () => {
    for (const quadrant of QUADRANTS) {
      const id = quadrantContainerId(quadrant.id)
      expect(parseQuadrantContainerId(id)).toBe(quadrant.id)
    }
  })

  it('devolve undefined para o id de uma tarefa (nao e um contentor)', () => {
    expect(parseQuadrantContainerId('550e8400-e29b-41d4-a716-446655440000')).toBeUndefined()
  })

  it('devolve undefined para um prefixo parecido mas invalido', () => {
    expect(parseQuadrantContainerId('container:q9')).toBeUndefined()
    expect(parseQuadrantContainerId('container:')).toBeUndefined()
  })

  it('aceita o id tambem como numero, sem lancar', () => {
    expect(parseQuadrantContainerId(123)).toBeUndefined()
  })
})
