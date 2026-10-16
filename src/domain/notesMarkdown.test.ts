import { describe, expect, it } from 'vitest'
import { buildNotesMarkdown } from './notesMarkdown.ts'
import type { Note } from './schema.ts'

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: null,
    body: 'Texto da reunião',
    tags: [],
    created_at: '2026-10-15T14:32:00.000Z',
    updated_at: '2026-10-15T14:32:00.000Z',
    deleted: false,
    deleted_at: null,
    device: 'pc empresa',
    ...overrides,
  }
}

/** Mesma conversão de `formatIncludedAt` (`notesMarkdown.ts`) - sem fixar um horário literal, porque usa o fuso LOCAL de quem exporta. */
function expectedIncludedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

describe('buildNotesMarkdown', () => {
  it('usa o título quando existe, com data de inclusão e corpo', () => {
    const md = buildNotesMarkdown([note({ title: 'Reunião de fornecedor', body: 'Texto da reunião' })])

    expect(md).toContain('## Reunião de fornecedor')
    expect(md).toContain(`**Incluída em:** ${expectedIncludedAt('2026-10-15T14:32:00.000Z')}`)
    expect(md).toContain('Texto da reunião')
  })

  it('usa a primeira linha do corpo como título quando não há título', () => {
    const md = buildNotesMarkdown([note({ title: null, body: 'Primeira linha\nResto do texto' })])
    expect(md).toContain('## Primeira linha')
  })

  it('inclui as tags, prefixadas com #', () => {
    const md = buildNotesMarkdown([note({ tags: ['fornecedor', 'urgente'] })])
    expect(md).toContain('**Tags:** #fornecedor #urgente')
  })

  it('não mostra a linha de tags quando a anotação não tem nenhuma', () => {
    const md = buildNotesMarkdown([note({ tags: [] })])
    expect(md).not.toContain('**Tags:**')
  })

  it('ordena por data de inclusão, mais antiga primeiro', () => {
    const recente = note({ id: 'n2', title: 'Recente', created_at: '2026-10-16T08:00:00.000Z' })
    const antiga = note({ id: 'n1', title: 'Antiga', created_at: '2026-10-10T08:00:00.000Z' })

    const md = buildNotesMarkdown([recente, antiga])
    expect(md.indexOf('## Antiga')).toBeLessThan(md.indexOf('## Recente'))
  })

  it('exclui anotações apagadas (lixeira)', () => {
    const apagada = note({ title: 'Apagada', deleted: true, deleted_at: '2026-10-16T08:00:00.000Z' })
    const md = buildNotesMarkdown([apagada])
    expect(md).not.toContain('Apagada')
  })

  it('devolve uma mensagem clara quando não há nenhuma anotação', () => {
    const md = buildNotesMarkdown([])
    expect(md).toContain('Nenhuma anotação ainda.')
  })

  it('separa anotações com um divisor horizontal', () => {
    const a = note({ id: 'n1', title: 'Primeira', created_at: '2026-10-10T08:00:00.000Z' })
    const b = note({ id: 'n2', title: 'Segunda', created_at: '2026-10-11T08:00:00.000Z' })
    const md = buildNotesMarkdown([a, b])
    expect(md).toContain('\n\n---\n\n')
  })
})
