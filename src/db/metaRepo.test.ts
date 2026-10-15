import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearPending, getMeta, markPendingInTx, unmarkPendingInTx } from './metaRepo.ts'
import { MatrizDB } from './schema.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-meta-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('getMeta', () => {
  it('devolve um padrao quando ainda nao ha linha de meta gravada', async () => {
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([])
    expect(meta.last_confirmed_revision).toBeNull()
    expect(meta.last_confirmed_checksum).toBeNull()
    expect(meta.schema_version).toBe(1)
  })
})

describe('markPendingInTx', () => {
  it('adiciona um id pendente', async () => {
    await db.transaction('rw', db.meta, async () => {
      await markPendingInTx(db, 'task-1')
    })
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual(['task-1'])
  })

  it('nao duplica o mesmo id marcado duas vezes', async () => {
    await db.transaction('rw', db.meta, async () => {
      await markPendingInTx(db, 'task-1')
      await markPendingInTx(db, 'task-1')
    })
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual(['task-1'])
  })

  it('acumula varios ids diferentes', async () => {
    await db.transaction('rw', db.meta, async () => {
      await markPendingInTx(db, 'task-1')
      await markPendingInTx(db, 'task-2')
    })
    const meta = await getMeta(db)
    expect(meta.pending_ids.toSorted()).toEqual(['task-1', 'task-2'])
  })
})

describe('unmarkPendingInTx', () => {
  it('remove um id especifico, mantendo os outros', async () => {
    await db.transaction('rw', db.meta, async () => {
      await markPendingInTx(db, 'task-1')
      await markPendingInTx(db, 'task-2')
      await unmarkPendingInTx(db, 'task-1')
    })
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual(['task-2'])
  })

  it('nao quebra ao remover um id que nao estava pendente', async () => {
    await db.transaction('rw', db.meta, async () => {
      await unmarkPendingInTx(db, 'inexistente')
    })
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([])
  })
})

describe('clearPending', () => {
  it('zera os pendentes e registra revisao e checksum confirmados', async () => {
    await db.transaction('rw', db.meta, async () => {
      await markPendingInTx(db, 'task-1')
    })

    await clearPending(db, 5, 'abc123')

    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([])
    expect(meta.last_confirmed_revision).toBe(5)
    expect(meta.last_confirmed_checksum).toBe('abc123')
  })

  it('preserva o nome do aparelho ja configurado', async () => {
    const before = await getMeta(db)
    await clearPending(db, 1, 'x')
    const after = await getMeta(db)
    expect(after.device_name).toBe(before.device_name)
  })
})
