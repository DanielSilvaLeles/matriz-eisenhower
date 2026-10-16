import { describe, expect, it } from 'vitest'
import { extractNoteTags } from './noteTags.ts'

describe('extractNoteTags', () => {
  it('extrai tags unicas em minusculas, na ordem de aparicao', () => {
    expect(extractNoteTags('Falar com #Fulano sobre #Projeto e #fulano de novo')).toEqual([
      'fulano',
      'projeto',
    ])
  })

  it('texto sem tag devolve lista vazia', () => {
    expect(extractNoteTags('Nada marcado aqui')).toEqual([])
  })

  it('NAO remove o #tag do texto original (diferente da caixa de entrada)', () => {
    const text = 'Combinar com #fulano o prazo'
    extractNoteTags(text)
    expect(text).toBe('Combinar com #fulano o prazo')
  })
})
