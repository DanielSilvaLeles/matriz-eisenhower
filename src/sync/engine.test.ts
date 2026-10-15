import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta } from '@/db/metaRepo.ts'
import { computeChecksum } from '@/domain/checksum.ts'
import { MatrizDB } from '@/db/schema.ts'
import { addTaskToQuadrant } from '@/db/tasksRepo.ts'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema.ts'
import { syncRequestSchema, type SyncData, type SyncRequest, type SyncResponse } from '@/domain/syncProtocol.ts'
import { getSyncToken, getSyncUrl, setSyncToken, setSyncUrl } from './config.ts'
import { runSync, syncStatusStore } from './engine.ts'

function noop(): void {}

function emptySyncData(): SyncData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tasks: [], task_events: [], people: [] }
}

/**
 * Reusa o `computeChecksum` DE VERDADE (nao uma reimplementacao paralela):
 * um servidor de mentira que calcula o checksum com uma logica levemente
 * diferente da real nunca bateria com o que o motor espera, mesmo para o
 * mesmo conteudo - e foi exatamente isso que aconteceu na primeira versao
 * deste teste (o helper daqui nao ordenava as chaves do nivel raiz, so as
 * de dentro de cada tarefa).
 */
function canonicalChecksum(d: SyncData): Promise<string> {
  return computeChecksum({ tasks: d.tasks, taskEvents: d.task_events, people: d.people })
}

/**
 * Servidor Apps Script simulado, em memoria: implementa pull/push/ping com
 * as mesmas regras de `apps-script/Code.gs` (conferir baseRevision, gerar
 * checksum da mesma forma), interceptando `global.fetch`. Nao reusa
 * `apps-script/test/harness.mjs` porque aquele carrega o `.gs` via `vm`
 * simulando os globais do Apps Script - aqui o alvo e o `callSync` do
 * front, entao o suficiente e simular as RESPOSTAS HTTP.
 */
function createFakeServer(token: string) {
  let revision = 0
  let data: SyncData = emptySyncData()

  async function handle(body: SyncRequest): Promise<SyncResponse> {
    if (body.token !== token) return { ok: false, error: 'unauthorized' }

    if (body.action === 'ping' || body.action === 'pull') {
      return { ok: true, revision, checksum: await canonicalChecksum(data), data }
    }

    if (body.data === undefined || body.baseRevision !== revision) {
      return { ok: false, error: body.data === undefined ? 'invalid' : 'conflict' }
    }
    data = body.data
    revision += 1
    return { ok: true, revision, checksum: await canonicalChecksum(data), data }
  }

  return {
    url: 'https://script.google.com/macros/s/fake/exec',
    fetchMock: vi.fn(async (_url: string, init: { body: string }) => {
      const body = syncRequestSchema.parse(JSON.parse(init.body))
      const result = await handle(body)
      return new Response(JSON.stringify(result), { status: 200 })
    }),
    revisionNow: () => revision,
  }
}

/**
 * `localStorage` no Node (ambiente dos testes) exige `--localstorage-file`
 * para funcionar de verdade - sem isso, toda leitura/escrita falha e
 * `src/sync/config.ts` (de proposito) engole o erro, tratando como "sem
 * armazenamento". Sem simular aqui, setSyncUrl/setSyncToken virariam no-op
 * silencioso e o teste nunca saberia a diferenca.
 */
function createFakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
}

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

  it('tarefa criada DURANTE o ciclo (depois do snapshot local, no meio do push) nao e perdida', async () => {
    // Regressao do bug real relatado em produção: `applyMergedState` usava
    // `clear()+bulkAdd()` a partir de um snapshot tirado no inicio do ciclo
    // (`readLocalState`). Uma escrita local que acontecesse DEPOIS desse
    // snapshot mas ANTES do ciclo terminar (pull -> push -> verificacao, um
    // tempo real de rede) sobrevivia no Dexie até o ciclo voltar e apagar a
    // tabela inteira para regravar so o que estava no snapshot antigo -
    // perdendo a tarefa nova sem aviso nenhum. Corrigido com `bulkPut`.
    const server = createFakeServer('segredo')
    let releasePush: () => void = noop
    const pushGate = new Promise<void>((resolve) => {
      releasePush = resolve
    })
    const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
      const body = syncRequestSchema.parse(JSON.parse(init.body))
      if (body.action === 'push') await pushGate
      return server.fetchMock(url, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Tarefa original')

    const syncPromise = runSync()

    // Espera o ciclo chegar ao push (ou seja: ja leu o snapshot local em
    // `readLocalState`, antes da escrita concorrente abaixo).
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => {
        const parsed = syncRequestSchema.parse(JSON.parse(call[1].body))
        return parsed.action === 'push'
      })).toBe(true)
    })

    // Escrita local DEPOIS do snapshot que o ciclo em voo ja leu - a mesma
    // corrida relatada em produção.
    await addTaskToQuadrant(db, 'q2', 'Tarefa criada durante o ciclo')

    releasePush()
    await syncPromise

    const titles = (await db.tasks.toArray()).map((task) => task.title)
    expect(titles).toContain('Tarefa original')
    expect(titles).toContain('Tarefa criada durante o ciclo')

    // A tarefa concorrente nao foi sincronizada por este ciclo (nao estava
    // no snapshot) - continua pendente para o proximo ciclo pegar, em vez
    // de o contador mentir que ja esta tudo confirmado.
    const meta = await getMeta(db)
    expect(meta.pending_ids).toHaveLength(1)
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
