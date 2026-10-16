import { describe, expect, it } from 'vitest'
import {
  filterNotes,
  hasActiveFilters,
  highlightSegments,
  noteMatchesQuery,
  normalizeForSearch,
} from './noteSearch.ts'
import type { Note } from './schema.ts'

const TODAY = '2026-10-15'

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: null,
    body: 'Reunião com fornecedor',
    tags: [],
    created_at: `${TODAY}T10:00:00.000Z`,
    updated_at: `${TODAY}T10:00:00.000Z`,
    deleted: false,
    deleted_at: null,
    device: 'pc',
    ...overrides,
  }
}

describe('normalizeForSearch', () => {
  it('remove acentos e normaliza para minusculas', () => {
    expect(normalizeForSearch('Reunião é às 14h')).toBe('reuniao e as 14h')
  })
})

describe('noteMatchesQuery', () => {
  it('busca ignora acentos e maiusculas, no titulo e no corpo', () => {
    expect(noteMatchesQuery({ title: null, body: 'Reunião com fornecedor' }, 'reuniao')).toBe(true)
    expect(noteMatchesQuery({ title: 'Reunião', body: 'x' }, 'REUNIAO')).toBe(true)
  })

  it('consulta vazia bate com tudo', () => {
    expect(noteMatchesQuery({ title: null, body: 'qualquer coisa' }, '')).toBe(true)
  })

  it('nao bate quando o texto nao contem a busca', () => {
    expect(noteMatchesQuery({ title: null, body: 'texto qualquer' }, 'inexistente')).toBe(false)
  })
})

describe('filterNotes', () => {
  const notes = [
    note({ id: 'a', tags: ['projeto'], created_at: `${TODAY}T09:00:00.000Z`, body: 'falar com fornecedor' }),
    note({ id: 'b', tags: ['pessoal'], created_at: '2026-09-01T09:00:00.000Z', body: 'outra coisa' }),
  ]

  it('filtra por tag', () => {
    const result = filterNotes(notes, { query: '', tag: 'projeto', period: { kind: 'all' } }, TODAY)
    expect(result.map((n) => n.id)).toEqual(['a'])
  })

  it('filtra por periodo "hoje"', () => {
    const result = filterNotes(notes, { query: '', tag: null, period: { kind: 'today' } }, TODAY)
    expect(result.map((n) => n.id)).toEqual(['a'])
  })

  it('filtra por intervalo de datas', () => {
    const result = filterNotes(
      notes,
      { query: '', tag: null, period: { kind: 'range', from: '2026-08-01', to: '2026-09-30' } },
      TODAY,
    )
    expect(result.map((n) => n.id)).toEqual(['b'])
  })

  it('combina busca de texto com filtro de tag (E, nao OU)', () => {
    const result = filterNotes(
      notes,
      { query: 'fornecedor', tag: 'pessoal', period: { kind: 'all' } },
      TODAY,
    )
    expect(result).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('nenhum filtro ativo com os padroes', () => {
    expect(hasActiveFilters({ query: '', tag: null, period: { kind: 'all' } })).toBe(false)
  })

  it('qualquer filtro preenchido conta como ativo', () => {
    expect(hasActiveFilters({ query: 'x', tag: null, period: { kind: 'all' } })).toBe(true)
    expect(hasActiveFilters({ query: '', tag: 'projeto', period: { kind: 'all' } })).toBe(true)
    expect(hasActiveFilters({ query: '', tag: null, period: { kind: 'today' } })).toBe(true)
  })
})

describe('highlightSegments', () => {
  it('sem busca, devolve um unico segmento sem marcacao', () => {
    expect(highlightSegments('texto qualquer', '')).toEqual([{ text: 'texto qualquer', match: false }])
  })

  it('marca o trecho encontrado, ignorando acento e caixa', () => {
    const segments = highlightSegments('Reunião às 14h', 'reuniao')
    expect(segments).toEqual([
      { text: 'Reunião', match: true },
      { text: ' às 14h', match: false },
    ])
  })

  it('marca todas as ocorrencias', () => {
    const segments = highlightSegments('foo bar foo', 'foo')
    expect(segments.filter((s) => s.match)).toHaveLength(2)
  })
})
