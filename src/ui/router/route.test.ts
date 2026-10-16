import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './route.ts'

describe('parseHash', () => {
  it('hash vazio ou "#/" cai na matriz', () => {
    expect(parseHash('')).toEqual({ screen: 'matrix' })
    expect(parseHash('#/')).toEqual({ screen: 'matrix' })
  })

  it('"#/anotacoes" e a lista', () => {
    expect(parseHash('#/anotacoes')).toEqual({ screen: 'notes-list' })
  })

  it('"#/anotacoes/ID" e o editor de uma anotacao existente', () => {
    expect(parseHash('#/anotacoes/abc-123')).toEqual({ screen: 'note-editor', noteId: 'abc-123' })
  })

  it('"#/anotacoes/nova" e o editor em branco (noteId null)', () => {
    expect(parseHash('#/anotacoes/nova')).toEqual({ screen: 'note-editor', noteId: null })
  })

  it('caminho desconhecido cai na matriz, nunca em erro', () => {
    expect(parseHash('#/qualquer-coisa')).toEqual({ screen: 'matrix' })
    expect(parseHash('#/anotacoes/id/extra')).toEqual({ screen: 'matrix' })
  })
})

describe('routeToHash', () => {
  it('e o inverso de parseHash para cada rota', () => {
    const routes = [
      { screen: 'matrix' as const },
      { screen: 'notes-list' as const },
      { screen: 'note-editor' as const, noteId: 'abc-123' },
      { screen: 'note-editor' as const, noteId: null },
    ]
    for (const route of routes) {
      expect(parseHash(routeToHash(route))).toEqual(route)
    }
  })
})
