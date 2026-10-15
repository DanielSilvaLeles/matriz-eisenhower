import { describe, expect, it } from 'vitest'
import { combineSharedText } from './shareTarget.ts'

describe('combineSharedText', () => {
  it('junta titulo, texto e url numa linha so (nunca com quebra de linha)', () => {
    // captureItem trata cada quebra de linha como um item separado (docs
    // secao 5.2) - um compartilhamento com title+text+url precisa virar UMA
    // tarefa so, nao tres.
    const combined = combineSharedText({
      title: 'Proposta do fornecedor',
      text: 'Ver anexo antes de responder',
      url: 'https://exemplo.com/doc',
    })
    expect(combined).toBe('Proposta do fornecedor — Ver anexo antes de responder — https://exemplo.com/doc')
    expect(combined).not.toContain('\n')
  })

  it('ignora campos ausentes ou vazios', () => {
    expect(combineSharedText({ title: null, text: 'So o texto', url: null })).toBe('So o texto')
    expect(combineSharedText({ title: '', text: '   ', url: 'https://x.com' })).toBe('https://x.com')
  })

  it('devolve null quando nenhum campo tem conteudo', () => {
    expect(combineSharedText({ title: null, text: null, url: null })).toBeNull()
    expect(combineSharedText({})).toBeNull()
  })
})
