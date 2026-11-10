import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// A função do FRONT, importada direto: a terceira cópia da canonicalização
// (esta API) é conferida contra a original, não contra uma reimplementação.
import { computeChecksum as frontChecksum } from '../../src/domain/checksum.ts'
import { computeChecksum, type SyncData } from '../src/checksum.ts'
import { doc, note, task } from './helpers.ts'

/** Mesmo fixture e hash de `testChecksum()` no Code.gs e de `src/domain/checksum.test.ts`. */
const FIXTURE_HASH = '56204de8c415f32ab09fd8ccde7a203fe20cbac02d141bbc3d49eb63a46dd7f4'

function asFront(data: SyncData) {
  return {
    tasks: data.tasks,
    taskEvents: data.task_events,
    people: data.people,
    notes: data.notes,
  } as unknown as Parameters<typeof frontChecksum>[0]
}

describe('checksum', () => {
  it('bate com o FIXTURE_HASH do front e do Code.gs', () => {
    const data = doc({
      tasks: [task({ id: '11111111-1111-4111-8111-111111111111' })],
      task_events: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          task_id: '11111111-1111-4111-8111-111111111111',
          type: 'created',
          from_quadrant: null,
          to_quadrant: 'q1',
          at: '2026-10-15T10:00:00.000Z',
          device: 'pc empresa',
        },
      ],
    })
    assert.equal(computeChecksum(data), FIXTURE_HASH)
  })

  it('bate com a função do front, inclusive com favorite ausente/true/false e acentos', async () => {
    const data = doc({
      tasks: [
        task({ title: 'Sem estrela' }),
        task({ title: 'Favoritada ✓', favorite: true, tags: ['ação', 'b'] }),
        task({ title: 'Desmarcada', favorite: false, position: 1500.25, date: '2026-11-09' }),
      ],
      people: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Ana', updated_at: '2026-10-15T10:00:00.000Z' }],
      notes: [note({ favorite: true, title: 'Ata' }), note()],
    })
    assert.equal(computeChecksum(data), await frontChecksum(asFront(data)))
  })

  it('distingue favorite ausente de favorite: false (o banco precisa preservar os dois)', () => {
    const base = task({ id: '44444444-4444-4444-8444-444444444444' })
    const absent = computeChecksum(doc({ tasks: [base] }))
    const falsy = computeChecksum(doc({ tasks: [{ ...base, favorite: false }] }))
    assert.notEqual(absent, falsy)
  })
})
