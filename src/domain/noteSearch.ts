/**
 * Busca e filtros da lista de anotações (`docs/prompt-anotacoes.md` seção
 * 4): "instantânea, local, ignorando acentos e maiúsculas, com o trecho
 * encontrado destacado"; filtros por tag e por período, combináveis.
 */
import { addDays } from './dateStatus.ts'
import { localDateOf } from './time.ts'
import type { Note } from './schema.ts'

/** Remove acentos e normaliza para minúsculas - "ignorando acentos e maiúsculas". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .toLowerCase()
}

export function noteMatchesQuery(note: Pick<Note, 'title' | 'body'>, query: string): boolean {
  const trimmed = query.trim()
  if (trimmed === '') return true
  const q = normalizeForSearch(trimmed)
  return normalizeForSearch(note.title ?? '').includes(q) || normalizeForSearch(note.body).includes(q)
}

export type NotePeriodFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'today' }
  | { readonly kind: 'last7' }
  | { readonly kind: 'last30' }
  | { readonly kind: 'range'; readonly from: string; readonly to: string }

function matchesPeriod(note: Note, filter: NotePeriodFilter, today: string): boolean {
  const day = localDateOf(note.created_at)
  if (filter.kind === 'all') return true
  if (filter.kind === 'today') return day === today
  if (filter.kind === 'last7') return day >= addDays(today, -6) && day <= today
  if (filter.kind === 'last30') return day >= addDays(today, -29) && day <= today
  return day >= filter.from && day <= filter.to
}

export interface NoteFilters {
  readonly query: string
  readonly tag: string | null
  readonly period: NotePeriodFilter
}

export const NO_FILTERS: NoteFilters = { query: '', tag: null, period: { kind: 'all' } }

export function hasActiveFilters(filters: NoteFilters): boolean {
  return filters.query.trim() !== '' || filters.tag !== null || filters.period.kind !== 'all'
}

/** Filtros combináveis por "e" (seção 4: "Filtros combináveis"). */
export function filterNotes(
  notes: readonly Note[],
  filters: NoteFilters,
  today: string,
): readonly Note[] {
  return notes.filter((note) => {
    if (filters.tag !== null && !note.tags.includes(filters.tag)) return false
    if (!matchesPeriod(note, filters.period, today)) return false
    return noteMatchesQuery(note, filters.query)
  })
}

export interface HighlightSegment {
  readonly text: string
  readonly match: boolean
}

/**
 * Divide `text` em trechos combinados/não-combinados com `query`, para a UI
 * marcar com `<mark>` (seção 4: "trecho encontrado destacado"). Assume que
 * normalizar não muda o comprimento em caracteres comuns do português
 * (acento vira 1 caractere base após NFD+remoção da marca) - suficiente
 * para o alfabeto que este app usa, sem ambição de rigor Unicode total.
 */
export function highlightSegments(text: string, query: string): readonly HighlightSegment[] {
  const trimmed = query.trim()
  if (trimmed === '') return [{ text, match: false }]

  const normalizedText = normalizeForSearch(text)
  const normalizedQuery = normalizeForSearch(trimmed)
  const segments: HighlightSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const idx = normalizedText.indexOf(normalizedQuery, cursor)
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), match: false })
      break
    }
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), match: false })
    segments.push({ text: text.slice(idx, idx + trimmed.length), match: true })
    cursor = idx + trimmed.length
  }

  return segments
}
