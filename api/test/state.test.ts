import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { computeChecksum } from '../src/checksum.ts'
import type { Pool } from '../src/db.ts'
import { pushDocument, readDocument, readStatus, replaceDocument } from '../src/state.ts'
import { doc, freshDatabase, note, skipWithoutDb, task, uuid } from './helpers.ts'

describe('estado no Postgres', { skip: skipWithoutDb }, () => {
  let pool: Pool

  before(async () => {
    pool = await freshDatabase()
  })
  beforeEach(async () => {
    await pool.query('TRUNCATE tasks, task_events, people, notes, sync_snapshots')
    await pool.query('UPDATE sync_state SET revision = 0, checksum = NULL, schema_version = 2')
  })
  after(async () => {
    await pool.end()
  })

  it('banco novo: revisão 0, documento vazio, checksum do vazio', async () => {
    const state = await readDocument(pool)
    assert.equal(state.revision, 0)
    assert.deepEqual(state.data, doc())
    assert.equal(state.checksum, computeChecksum(doc()))
    assert.deepEqual(await readStatus(pool), { revision: 0, checksum: computeChecksum(doc()) })
  })

  it('ida e volta exata: o checksum relido é o checksum do que o front mandou', async () => {
    const data = doc({
      tasks: [
        task({ position: 1234.5678901234, date: '2026-11-09', tags: ['ação', 'b,c', 'com "aspas"'] }),
        task({ completed_at: '2026-11-09T23:59:59.999Z', status: 'done', quadrant: null, notes: 'linha 1\nlinha 2' }),
        task({ source_note_id: '00000000-0000-4000-8000-0000000000ff', source: 'note', context: 'personal' }),
      ],
      task_events: [
        { id: uuid(), task_id: uuid(), type: 'moved', from_quadrant: null, to_quadrant: 'q2', at: '2026-01-01T00:00:00.000Z', device: 'celular' },
      ],
      people: [{ id: uuid(), name: 'Ana', updated_at: '2026-10-15T10:00:00.000Z' }],
      notes: [note({ deleted: true, deleted_at: '2026-10-16T08:30:00.123Z', title: 'Ata', tags: ['1:1'] })],
    })
    const result = await pushDocument(pool, { baseRevision: 0, data, allowShrink: false })
    assert.equal(result.ok, true)
    const reread = await readDocument(pool)
    assert.equal(reread.revision, 1)
    assert.equal(reread.checksum, computeChecksum(data))
    assert.deepEqual(await readStatus(pool), { revision: 1, checksum: computeChecksum(data) })
  })

  it('date não muda de dia com TZ do processo diferente de UTC', async () => {
    const data = doc({ tasks: [task({ date: '2026-03-01' })] })
    await pushDocument(pool, { baseRevision: 0, data, allowShrink: false })
    const reread = await readDocument(pool)
    assert.equal(reread.data.tasks[0]?.['date'], '2026-03-01')
  })

  it('favorite: ausente continua ausente, false continua false, true continua true', async () => {
    const absent = task()
    const off = task({ favorite: false })
    const on = task({ favorite: true })
    const offNote = note({ favorite: false })
    await pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [absent, off, on], notes: [offNote] }), allowShrink: false })
    const { data } = await readDocument(pool)
    const byId = new Map(data.tasks.map((t) => [t['id'], t]))
    assert.equal('favorite' in byId.get(absent['id'])!, false)
    assert.equal(byId.get(off['id'])?.['favorite'], false)
    assert.equal(byId.get(on['id'])?.['favorite'], true)
    assert.equal(data.notes[0]?.['favorite'], false)
  })

  it('chave desconhecida (campo novo do front, sem coluna ainda) sobrevive em `extra`', async () => {
    const withExtra = task({ pinned_until: '2026-12-01', meta: { a: [1, null] } })
    const data = doc({ tasks: [withExtra] })
    await pushDocument(pool, { baseRevision: 0, data, allowShrink: false })
    const reread = await readDocument(pool)
    assert.deepEqual(reread.data.tasks[0], withExtra)
    assert.equal(reread.checksum, computeChecksum(data))
  })

  it('baseRevision desatualizado → conflict, sem gravar nada', async () => {
    await pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [task()] }), allowShrink: false })
    const result = await pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [task(), task()] }), allowShrink: false })
    assert.deepEqual(result, { ok: false, error: 'conflict' })
    assert.equal((await readDocument(pool)).data.tasks.length, 1)
  })

  it('dois pushes simultâneos com a mesma base: exatamente um vence', async () => {
    const results = await Promise.all([
      pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [task()] }), allowShrink: false }),
      pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [task()] }), allowShrink: false }),
    ])
    assert.deepEqual(results.map((r) => r.ok).toSorted((a, b) => Number(a) - Number(b)), [false, true])
    assert.equal((await readStatus(pool)).revision, 1)
  })

  it('encolhimento drástico sem allowShrink → invalid; com allowShrink → grava', async () => {
    const tasks = [task(), task(), task(), task()]
    await pushDocument(pool, { baseRevision: 0, data: doc({ tasks }), allowShrink: false })
    const refused = await pushDocument(pool, { baseRevision: 1, data: doc({ tasks: [tasks[0]!] }), allowShrink: false })
    assert.deepEqual(refused, { ok: false, error: 'invalid' })
    const allowed = await pushDocument(pool, { baseRevision: 1, data: doc({ tasks: [tasks[0]!] }), allowShrink: true })
    assert.equal(allowed.ok, true)
    assert.equal((await readDocument(pool)).data.tasks.length, 1)
  })

  it('item que sumiu do documento (tombstone limpo) é apagado da tabela', async () => {
    const keep = task()
    const purge = task({ deleted: true })
    await pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [keep, purge, task()] }), allowShrink: false })
    await pushDocument(pool, { baseRevision: 1, data: doc({ tasks: [keep, task()] }), allowShrink: false })
    const ids = (await readDocument(pool)).data.tasks.map((t) => t['id'])
    assert.equal(ids.includes(purge['id']), false)
    assert.equal(ids.includes(keep['id']), true)
  })

  it('server_updated_at só muda na linha que mudou de verdade; updated_at do domínio fica o do cliente', async () => {
    const a = task()
    const b = task()
    await pushDocument(pool, { baseRevision: 0, data: doc({ tasks: [a, b] }), allowShrink: false })
    const stamps = async () =>
      new Map(
        (await pool.query<{ id: string; server_updated_at: Date }>('SELECT id, server_updated_at FROM tasks')).rows.map((r) => [
          r.id,
          r.server_updated_at.getTime(),
        ]),
      )
    const first = await stamps()
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
    const editedB = { ...b, favorite: true, updated_at: '2026-10-15T11:00:00.000Z' }
    await pushDocument(pool, { baseRevision: 1, data: doc({ tasks: [a, editedB] }), allowShrink: false })
    const second = await stamps()
    assert.equal(second.get(a['id'] as string), first.get(a['id'] as string))
    assert.ok(second.get(b['id'] as string)! > first.get(b['id'] as string)!)
    const reread = (await readDocument(pool)).data.tasks.find((t) => t['id'] === b['id'])
    assert.equal(reread?.['updated_at'], '2026-10-15T11:00:00.000Z')
  })

  it('guarda só as duas versões anteriores (bak1/bak2)', async () => {
    let revision = 0
    for (let i = 0; i < 4; i++) {
      const result = await pushDocument(pool, { baseRevision: revision, data: doc({ tasks: [task()] }), allowShrink: true })
      assert.equal(result.ok, true)
      revision += 1
    }
    const snaps = await pool.query<{ revision: number }>('SELECT revision FROM sync_snapshots ORDER BY revision')
    assert.deepEqual(snaps.rows.map((r) => r.revision), [2, 3])
  })

  it('replaceDocument (importação) preserva a revisão de origem e é idempotente', async () => {
    const data = doc({ tasks: [task({ favorite: true })], notes: [note()] })
    const first = await replaceDocument(pool, 594, data)
    const second = await replaceDocument(pool, 594, data)
    assert.equal(first.revision, 594)
    assert.equal(second.checksum, first.checksum)
    assert.equal(first.checksum, computeChecksum(data))
    assert.equal((await readDocument(pool)).data.tasks.length, 1)
  })
})
