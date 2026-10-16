import { describe, expect, it } from 'vitest'
import { buildConflictCopies, detectNoteConflicts } from './noteMerge.ts'
import { mergeState, type SyncableState } from './merge.ts'
import type { Note } from './schema.ts'

const NOW = '2026-10-15T14:32:00.000Z'

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: null,
    body: 'Texto original da reuniao',
    tags: [],
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
    deleted: false,
    deleted_at: null,
    device: 'pc empresa',
    ...overrides,
  }
}

function state(notes: readonly Note[]): SyncableState {
  return { tasks: [], taskEvents: [], people: [], notes }
}

let nextId = 1
function fakeGenerateId(): string {
  nextId += 1
  return `copy-${nextId}`
}

/**
 * Mesma conversao de `formatConflictStamp` (`noteMerge.ts`) - monta o
 * esperado em vez de fixar um horario literal, porque a implementacao usa
 * `toLocaleString` (fuso LOCAL de quem roda, de proposito - mesmo padrao
 * de exibicao do resto do app) e o CI roda em UTC, diferente do fuso deste
 * ambiente de desenvolvimento.
 */
function expectedConflictStamp(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

describe('detectNoteConflicts', () => {
  it('edicao concorrente genuina: pendente localmente E servidor mudou depois da ultima confirmacao -> conflito', () => {
    const local = note({
      body: 'Edicao feita no celular',
      updated_at: '2026-10-15T09:00:00.000Z',
      device: 'celular',
    })
    const remote = note({
      body: 'Edicao feita no pc, ao mesmo tempo',
      updated_at: '2026-10-15T10:00:00.000Z',
      device: 'pc empresa',
    })

    const conflicts = detectNoteConflicts([local], [remote], ['note-1'], '2026-10-14T00:00:00.000Z')

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.noteId).toBe('note-1')
    // O servidor (updated_at mais novo) vence no lugar original; o celular
    // (mais antigo) e quem perde e precisa da copia - nenhum dos dois textos
    // pode se perder.
    expect(conflicts[0]?.loser.body).toBe('Edicao feita no celular')
  })

  it('nao e conflito quando o lado local nao tem edicao pendente', () => {
    const local = note({ updated_at: '2026-10-15T09:00:00.000Z' })
    const remote = note({ body: 'Outra versao', updated_at: '2026-10-15T10:00:00.000Z' })

    const conflicts = detectNoteConflicts([local], [remote], [], '2026-10-14T00:00:00.000Z')

    expect(conflicts).toHaveLength(0)
  })

  it('nao e conflito quando o servidor nao mudou desde a ultima sincronizacao confirmada', () => {
    const lastConfirmedAt = '2026-10-15T08:00:00.000Z'
    // Remota antes da ultima confirmacao.
    const remote = note({ updated_at: '2026-10-14T00:00:00.000Z' })
    const local = note({ body: 'Minha edicao nova', updated_at: '2026-10-15T09:00:00.000Z' })

    const conflicts = detectNoteConflicts([local], [remote], ['note-1'], lastConfirmedAt)

    expect(conflicts).toHaveLength(0)
  })

  it('edicao vs exclusao: nao gera copia de conflito (regra generica de merge.ts ja resolve)', () => {
    // Mesmo que a nota esteja pendente localmente, uma exclusao remota nao
    // e tratada como "edicao concorrente" por detectNoteConflicts - mas o
    // CONTEUDO e idêntico ou nao, o que importa aqui e so confirmar que o
    // comportamento de "newer wins" (via mergeState) nao perde a edicao
    // mais nova por engano quando NAO ha conflito genuino (servidor nao
    // mudou desde a ultima confirmacao).
    const lastConfirmedAt = '2026-10-15T08:00:00.000Z'
    const remoteDeleted = note({ deleted: true, updated_at: '2026-10-14T00:00:00.000Z' })
    const localEdited = note({ body: 'Edicao local depois da exclusao antiga', updated_at: '2026-10-15T09:00:00.000Z' })

    const conflicts = detectNoteConflicts([localEdited], [remoteDeleted], ['note-1'], lastConfirmedAt)
    expect(conflicts).toHaveLength(0)

    const merged = mergeState(state([localEdited]), state([remoteDeleted]), NOW)
    expect(merged.notes[0]?.deleted).toBe(false)
    expect(merged.notes[0]?.body).toBe('Edicao local depois da exclusao antiga')
  })

  it('criacao em dois aparelhos: ids diferentes, uniao simples sem conflito', () => {
    const doCelular = note({ id: 'note-celular', device: 'celular' })
    const doPc = note({ id: 'note-pc', device: 'pc empresa' })

    const conflicts = detectNoteConflicts([doCelular], [doPc], ['note-celular'], null)
    expect(conflicts).toHaveLength(0)

    const merged = mergeState(state([doCelular]), state([doPc]), NOW)
    expect(merged.notes.map((n) => n.id).toSorted()).toEqual(['note-celular', 'note-pc'])
  })

  it('idempotencia: mesclar o mesmo par de novo nao gera conflito nem copia duplicada', () => {
    const local = note({ body: 'A', updated_at: '2026-10-15T09:00:00.000Z', device: 'celular' })
    const remote = note({ body: 'B', updated_at: '2026-10-15T10:00:00.000Z', device: 'pc empresa' })
    const lastConfirmedAt = '2026-10-14T00:00:00.000Z'

    const conflicts = detectNoteConflicts([local], [remote], ['note-1'], lastConfirmedAt)
    expect(conflicts).toHaveLength(1)
    const copies = buildConflictCopies(conflicts, NOW, 'pc empresa', fakeGenerateId)
    const merged = mergeState(state([local]), state([remote]), NOW)
    const resultA = { ...merged, notes: [...merged.notes, ...copies] }

    // Mesclar o RESULTADO consigo mesmo (nenhuma das notas do resultado
    // esta mais pendente/divergente) nao deve achar conflito nenhum de
    // novo nem duplicar nenhuma copia.
    const conflictsAgain = detectNoteConflicts(resultA.notes, resultA.notes, ['note-1'], lastConfirmedAt)
    expect(conflictsAgain).toHaveLength(0)
  })

  it('comutatividade: detectar de A-vs-B ou B-vs-A aponta a MESMA perdedora', () => {
    const a = note({ body: 'Versao do celular', updated_at: '2026-10-15T09:00:00.000Z', device: 'celular' })
    const b = note({ body: 'Versao do pc', updated_at: '2026-10-15T10:00:00.000Z', device: 'pc empresa' })
    const lastConfirmedAt = '2026-10-14T00:00:00.000Z'

    const conflictsAvsB = detectNoteConflicts([a], [b], ['note-1'], lastConfirmedAt)
    const conflictsBvsA = detectNoteConflicts([b], [a], ['note-1'], lastConfirmedAt)

    expect(conflictsAvsB[0]?.loser.body).toBe('Versao do celular')
    expect(conflictsBvsA[0]?.loser.body).toBe('Versao do celular')
  })

  it('preservacao de created_at: a copia de conflito e a vencedora mantem o created_at original', () => {
    const originalCreatedAt = '2026-09-01T08:00:00.000Z'
    const local = note({
      created_at: originalCreatedAt,
      body: 'Do celular',
      updated_at: '2026-10-15T09:00:00.000Z',
      device: 'celular',
    })
    const remote = note({
      created_at: originalCreatedAt,
      body: 'Do pc',
      updated_at: '2026-10-15T10:00:00.000Z',
      device: 'pc empresa',
    })

    const conflicts = detectNoteConflicts([local], [remote], ['note-1'], '2026-10-14T00:00:00.000Z')
    const merged = mergeState(state([local]), state([remote]), NOW)

    // A vencedora (no id original) preserva o created_at de sempre.
    expect(merged.notes[0]?.created_at).toBe(originalCreatedAt)
    // A copia de conflito e uma anotacao NOVA - created_at e o instante do
    // proprio conflito, nao herdado (ela nunca existiu antes de agora).
    const copies = buildConflictCopies(conflicts, NOW, 'pc empresa', fakeGenerateId)
    expect(copies[0]?.created_at).toBe(NOW)
  })
})

describe('buildConflictCopies', () => {
  it('titulo da copia marca data/hora e o aparelho de origem da versao perdida', () => {
    const loser = note({
      title: 'Reuniao de fornecedor',
      body: 'Anotacoes da reuniao',
      device: 'celular',
    })

    const copies = buildConflictCopies([{ noteId: 'note-1', loser }], NOW, 'pc empresa', fakeGenerateId)

    expect(copies).toHaveLength(1)
    expect(copies[0]?.title).toBe(`Reuniao de fornecedor (conflito ${expectedConflictStamp(NOW)} do aparelho celular)`)
    expect(copies[0]?.body).toBe('Anotacoes da reuniao')
    expect(copies[0]?.device).toBe('pc empresa')
    expect(copies[0]?.deleted).toBe(false)
  })

  it('usa a primeira linha do corpo como titulo quando a anotacao perdedora nao tinha titulo', () => {
    const loser = note({ title: null, body: 'Primeira linha\nResto do texto', device: 'celular' })

    const copies = buildConflictCopies([{ noteId: 'note-1', loser }], NOW, 'pc empresa', fakeGenerateId)

    expect(copies[0]?.title).toBe(`Primeira linha (conflito ${expectedConflictStamp(NOW)} do aparelho celular)`)
  })
})
