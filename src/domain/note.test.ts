import { describe, expect, it } from 'vitest'
import { continuationPrefixFor, createNote, deleteNote, editNote, restoreNote } from './note.ts'
import type { Note } from './schema.ts'

const NOW = '2026-10-15T10:00:00.000Z'
const LATER = '2026-10-15T10:05:00.000Z'

function baseNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: null,
    body: 'Reunião com o fornecedor #compras',
    tags: ['compras'],
    created_at: NOW,
    updated_at: NOW,
    deleted: false,
    deleted_at: null,
    device: 'pc empresa',
    ...overrides,
  }
}

describe('createNote', () => {
  it('cria com os padroes certos e extrai tags do corpo', () => {
    const note = createNote({ id: 'note-1', body: 'Falar com #fulano sobre o prazo', device: 'pc empresa' }, NOW)

    expect(note).toMatchObject({
      id: 'note-1',
      title: null,
      body: 'Falar com #fulano sobre o prazo',
      tags: ['fulano'],
      deleted: false,
      deleted_at: null,
      device: 'pc empresa',
    })
    expect(note.created_at).toBe(NOW)
    expect(note.updated_at).toBe(NOW)
  })

  it('recusa corpo vazio', () => {
    expect(() => createNote({ id: 'note-1', body: '', device: 'pc' }, NOW)).toThrow()
    expect(() => createNote({ id: 'note-1', body: '   ', device: 'pc' }, NOW)).toThrow()
  })

  it('titulo vazio ou ausente vira null', () => {
    const semTitulo = createNote({ id: 'note-1', body: 'x', device: 'pc' }, NOW)
    expect(semTitulo.title).toBeNull()

    const tituloEmBranco = createNote({ id: 'note-1', body: 'x', title: '   ', device: 'pc' }, NOW)
    expect(tituloEmBranco.title).toBeNull()
  })
})

describe('editNote', () => {
  it('atualiza o corpo e recalcula as tags, sem tocar created_at', () => {
    const note = baseNote()
    const edited = editNote(note, { body: 'Novo corpo #urgente' }, 'celular', LATER)

    expect(edited.body).toBe('Novo corpo #urgente')
    expect(edited.tags).toEqual(['urgente'])
    expect(edited.created_at).toBe(NOW)
    expect(edited.updated_at).toBe(LATER)
    expect(edited.device).toBe('celular')
  })

  it('nao muda as tags quando so o titulo e editado', () => {
    const note = baseNote()
    const edited = editNote(note, { title: 'Novo título' }, 'celular', LATER)

    expect(edited.title).toBe('Novo título')
    expect(edited.tags).toEqual(note.tags)
    expect(edited.body).toBe(note.body)
  })

  it('o texto do corpo NAO perde o #tag digitado (decisão registrada)', () => {
    const note = baseNote()
    const edited = editNote(note, { body: 'Combinar com #fulano' }, 'pc', LATER)
    expect(edited.body).toContain('#fulano')
  })
})

describe('deleteNote / restoreNote', () => {
  it('apaga marcando deleted e deleted_at, sem apagar de verdade', () => {
    const note = baseNote()
    const deleted = deleteNote(note, 'celular', LATER)

    expect(deleted.deleted).toBe(true)
    expect(deleted.deleted_at).toBe(LATER)
    expect(deleted.updated_at).toBe(LATER)
    expect(deleted.body).toBe(note.body)
  })

  it('restaurar limpa deleted e deleted_at', () => {
    const deleted = deleteNote(baseNote(), 'celular', LATER)
    const restored = restoreNote(deleted, 'pc', '2026-10-15T10:10:00.000Z')

    expect(restored.deleted).toBe(false)
    expect(restored.deleted_at).toBeNull()
  })
})

describe('continuationPrefixFor', () => {
  it('continua marcador de lista simples "- "', () => {
    expect(continuationPrefixFor('- primeiro item')).toBe('- ')
  })

  it('continua marcador de checklist "[ ] "', () => {
    expect(continuationPrefixFor('[ ] revisar contrato')).toBe('[ ] ')
  })

  it('continua marcador combinado "- [ ] "', () => {
    expect(continuationPrefixFor('- [ ] revisar contrato')).toBe('- [ ] ')
  })

  it('preserva indentação', () => {
    expect(continuationPrefixFor('  - item indentado')).toBe('  - ')
  })

  it('linha sem marcador devolve null', () => {
    expect(continuationPrefixFor('texto comum')).toBeNull()
  })

  it('linha so com o marcador (vazia) encerra a lista', () => {
    expect(continuationPrefixFor('- ')).toBeNull()
    expect(continuationPrefixFor('[ ] ')).toBeNull()
  })
})
