import { describe, expect, it } from 'vitest'
import { groupNotesByDay } from './noteGrouping.ts'
import type { Note } from './schema.ts'

const TODAY = '2026-10-15'

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: null,
    body: 'x',
    tags: [],
    created_at: `${TODAY}T10:00:00.000Z`,
    updated_at: `${TODAY}T10:00:00.000Z`,
    deleted: false,
    deleted_at: null,
    device: 'pc',
    ...overrides,
  }
}

describe('groupNotesByDay', () => {
  it('agrupa hoje e ontem com rotulos especiais', () => {
    const groups = groupNotesByDay(
      [
        note({ id: 'a', created_at: '2026-10-15T09:00:00.000Z' }),
        note({ id: 'b', created_at: '2026-10-14T20:00:00.000Z' }),
      ],
      TODAY,
    )

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ label: 'Hoje', day: '2026-10-15' })
    expect(groups[0]?.notes.map((n) => n.id)).toEqual(['a'])
    expect(groups[1]).toMatchObject({ label: 'Ontem', day: '2026-10-14' })
  })

  it('data mais antiga usa o rotulo completo com dia da semana', () => {
    const groups = groupNotesByDay([note({ id: 'a', created_at: '2026-10-01T09:00:00.000Z' })], TODAY)
    expect(groups[0]?.label).toContain('01/10/2026')
  })

  it('preserva a ordem de entrada dentro do mesmo dia', () => {
    const groups = groupNotesByDay(
      [
        note({ id: 'segundo', created_at: '2026-10-15T15:00:00.000Z' }),
        note({ id: 'primeiro', created_at: '2026-10-15T09:00:00.000Z' }),
      ],
      TODAY,
    )
    expect(groups[0]?.notes.map((n) => n.id)).toEqual(['segundo', 'primeiro'])
  })

  it('lista vazia devolve nenhum grupo', () => {
    expect(groupNotesByDay([], TODAY)).toEqual([])
  })
})
