import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSyncData } from '../src/validate.ts'
import { doc, note, task } from './helpers.ts'

describe('parseSyncData', () => {
  it('aceita o documento normal, com e sem favorite', () => {
    assert.ok(parseSyncData(doc({ tasks: [task(), task({ favorite: false })], notes: [note({ favorite: true })] })))
  })

  it('documento sem a chave notes (script/front antigos) vira notes: []', () => {
    const { notes: _ignored, ...legacy } = doc({ tasks: [task()] })
    assert.deepEqual(parseSyncData(legacy)?.notes, [])
  })

  it('recusa o que o Postgres não devolveria idêntico', () => {
    const cases: Record<string, unknown>[] = [
      // Sem milissegundos, com fuso, uuid maiúsculo:
      task({ created_at: '2026-10-15T10:00:00Z' }),
      task({ updated_at: '2026-10-15T10:00:00.000-03:00' }),
      task({ id: 'AAAAAAAA-0000-4000-8000-000000000001' }),
      task({ title: 'nul\u0000' }),
      task({ date: '15/10/2026' }),
      task({ favorite: null }),
      task({ position: Number.NaN }),
    ]
    for (const bad of cases) assert.equal(parseSyncData(doc({ tasks: [bad] })), null, JSON.stringify(bad))
  })

  it('recusa id repetido na mesma entidade', () => {
    const t = task()
    assert.equal(parseSyncData(doc({ tasks: [t, { ...t }] })), null)
  })
})
