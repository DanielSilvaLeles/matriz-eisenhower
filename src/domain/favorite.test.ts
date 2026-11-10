import { describe, expect, it } from 'vitest'
import { favoritesFirst, isFavorite } from './favorite.ts'

describe('isFavorite', () => {
  it('ausente ou false = nao favorita; so true conta', () => {
    expect(isFavorite({})).toBe(false)
    expect(isFavorite({ favorite: false })).toBe(false)
    expect(isFavorite({ favorite: true })).toBe(true)
  })
})

describe('favoritesFirst', () => {
  it('poe as favoritas no topo, preservando a ordem relativa de cada grupo', () => {
    const items = [
      { id: 'a' },
      { id: 'b', favorite: true },
      { id: 'c', favorite: false },
      { id: 'd', favorite: true },
    ]
    expect(favoritesFirst(items).map((i) => i.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('nao altera a lista original', () => {
    const items = [{ id: 'a' }, { id: 'b', favorite: true }]
    favoritesFirst(items)
    expect(items.map((i) => i.id)).toEqual(['a', 'b'])
  })
})
