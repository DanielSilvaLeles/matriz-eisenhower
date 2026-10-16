import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta } from '@/db/metaRepo.ts'
import { MatrizDB } from '@/db/schema.ts'
import { addTaskToQuadrant } from '@/db/tasksRepo.ts'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema.ts'
import { createFakeLocalStorage, createFakeServer } from './engine.testHelpers.ts'
import { getSyncToken, getSyncUrl, setSyncToken, setSyncUrl } from './config.ts'
import { runSync, syncStatusStore } from './engine.ts'

/**
 * Cenarios de corrida entre uma escrita local e um ciclo de sync em voo
 * ficam em `engine.raceConditions.test.ts` - separado so pelo limite de
 * linhas do lint, mesma configuracao de teste.
 */

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-sync-${crypto.randomUUID()}`)
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('localStorage', createFakeLocalStorage())
  setSyncUrl('')
  setSyncToken('')
})

afterEach(async () => {
  await db.delete()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// getDB() usado pelo engine aponta para o banco "de verdade" (singleton) -
// os testes aqui precisam que ele resolva para o `db` de teste. Como
// `src/db/schema.ts` usa um singleton por processo, trocamos o nome do
// banco padrao via o mesmo nome usado pelo singleton nao e possivel sem
// tocar o modulo - em vez disso, os testes abaixo usam `vi.doMock` no
// modulo `@/db/schema.ts` substituindo `getDB` pelo banco de teste.
vi.mock('@/db/schema.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/schema.ts')>()
  return {
    ...actual,
    getDB: () => db,
  }
})

describe('runSync', () => {
  it('sem URL/token configurados, fica "not_configured" e nao tenta rede', async () => {
    await runSync()
    expect(syncStatusStore.get()).toEqual({ kind: 'not_configured' })
  })

  it('primeiro sync: envia as tarefas locais, fica "confirmed", limpa a pendencia', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    expect((await getMeta(db)).pending_ids).toHaveLength(1)

    await runSync()

    const status = syncStatusStore.get()
    expect(status.kind).toBe('confirmed')
    expect(server.revisionNow()).toBe(1)

    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([])
    expect(meta.last_confirmed_revision).toBe(1)
  })

  it('traz uma tarefa criada em outro aparelho (so pull, sem nada local pendente)', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    // Simula outro aparelho ja tendo empurrado uma tarefa antes deste sync.
    await server.fetchMock(server.url, {
      body: JSON.stringify({
        token: 'segredo',
        action: 'push',
        baseRevision: 0,
        data: {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          tasks: [
            {
              id: '99999999-9999-4999-8999-999999999999',
              title: 'Veio de outro aparelho',
              notes: null,
              quadrant: 'q2',
              status: 'open',
              position: 1000,
              date: null,
              delegated_to: null,
              delegation_context: null,
              expected_outcome: null,
              tags: [],
              source: 'web',
              context: 'work',
              created_at: '2026-10-15T09:00:00.000Z',
              updated_at: '2026-10-15T09:00:00.000Z',
              completed_at: null,
              deleted: false,
              device: 'celular',
            },
          ],
          task_events: [],
          people: [],
        },
      }),
    })

    await runSync()

    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.title).toBe('Veio de outro aparelho')
  })

  it('recusado por token errado: fica em erro "unauthorized"', async () => {
    const server = createFakeServer('token-certo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('token-errado')

    await runSync()

    expect(syncStatusStore.get()).toEqual({ kind: 'error', reason: 'unauthorized' })
  })

  it('offline: nem tenta a rede, fica "offline"', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setSyncUrl('https://script.google.com/macros/s/fake/exec')
    setSyncToken('segredo')

    await runSync()

    expect(syncStatusStore.get()).toEqual({ kind: 'offline' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('duas chamadas simultaneas de runSync fazem so um ciclo', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    const [a, b] = await Promise.all([runSync(), runSync()])
    expect(a).toBeUndefined()
    expect(b).toBeUndefined()
    // Um unico pull (e nenhum push, ja que nao havia nada local) - duas
    // chamadas de runSync nao duplicaram o ciclo.
    expect(server.fetchMock.mock.calls.length).toBeLessThanOrEqual(1)
  })
})

describe('getSyncUrl/getSyncToken', () => {
  it('ficam vazios por padrao', () => {
    expect(getSyncUrl()).toBe('')
    expect(getSyncToken()).toBe('')
  })
})
