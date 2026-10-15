import { describe, expect, it } from 'vitest'
import {
  INITIAL_POSITION,
  needsRenormalization,
  positionBetween,
  renormalize,
} from './position.ts'

/** Afirma que o valor nao e undefined, estreitando o tipo sem `as` nem `!`. */
function assertDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined()
}

describe('positionBetween', () => {
  it('da a primeira posicao de um quadrante vazio', () => {
    expect(positionBetween(null, null)).toBe(INITIAL_POSITION)
  })

  it('posiciona antes da primeira tarefa existente', () => {
    const first = positionBetween(null, null)
    const before = positionBetween(null, first)
    expect(before).toBeLessThan(first)
  })

  it('posiciona depois da ultima tarefa existente', () => {
    const last = positionBetween(null, null)
    const after = positionBetween(last, null)
    expect(after).toBeGreaterThan(last)
  })

  it('posiciona exatamente no meio de duas vizinhas', () => {
    expect(positionBetween(10, 20)).toBe(15)
  })

  it('aceita qualquer ordem de insercao e preserva a ordenacao resultante', () => {
    // Insere 5 tarefas em sequencia, sempre no fim - como alguem digitando
    // uma lista no campo "Adicionar tarefa".
    const positions: number[] = []
    let last: number | null = null
    for (let i = 0; i < 5; i++) {
      const p = positionBetween(last, null)
      positions.push(p)
      last = p
    }
    const sorted = positions.toSorted((a, b) => a - b)
    expect(positions).toEqual(sorted)
  })

  it('insere repetidamente entre as duas mesmas vizinhas sem jamais cruzar', () => {
    // Simula arrastar sempre para o mesmo intervalo: e o pior caso para
    // precisao de ponto flutuante.
    let before = 0
    let after = 1000
    for (let i = 0; i < 40; i++) {
      const mid = positionBetween(before, after)
      expect(mid).toBeGreaterThan(before)
      expect(mid).toBeLessThan(after)
      after = mid
    }
  })
})

describe('needsRenormalization', () => {
  it('nao aciona para um intervalo normal', () => {
    expect(needsRenormalization(10, 20)).toBe(false)
  })

  it('aciona quando o intervalo fica pequeno demais para bissetar com confianca', () => {
    expect(needsRenormalization(10, 10 + 1e-10)).toBe(true)
  })

  it('eventualmente aciona ao bissetar repetidamente o mesmo intervalo', () => {
    let before = 0
    let after = 1000
    let renormalizations = 0
    for (let i = 0; i < 200; i++) {
      if (needsRenormalization(before, after)) {
        renormalizations++
        break
      }
      after = positionBetween(before, after)
    }
    expect(renormalizations).toBe(1)
  })
})

describe('renormalize', () => {
  it('espaca igualmente preservando a ordem recebida', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const result = renormalize(items, (item) => item.id)
    const posA = result.get('a')
    const posB = result.get('b')
    const posC = result.get('c')
    assertDefined(posA)
    assertDefined(posB)
    assertDefined(posC)

    expect(posA).toBeLessThan(posB)
    expect(posB).toBeLessThan(posC)
    expect(result.size).toBe(3)
  })

  it('aceita lista vazia', () => {
    expect(renormalize([], (item: { id: string }) => item.id).size).toBe(0)
  })

  it('aceita um unico item', () => {
    const result = renormalize([{ id: 'so' }], (item) => item.id)
    expect(result.get('so')).toBeGreaterThan(0)
  })
})
