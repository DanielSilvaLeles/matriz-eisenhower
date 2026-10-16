/**
 * Ajudas compartilhadas entre `engine.test.ts` e
 * `engine.raceConditions.test.ts` - separado so pelo limite de linhas do
 * lint (os dois arquivos de teste cresceriam juntos do mesmo jeito, mesma
 * convencao de `tasksRepo.lifecycle.ts` separar de `tasksRepo.ts`).
 */
import { vi } from 'vitest'
import { computeChecksum } from '@/domain/checksum.ts'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema.ts'
import { syncRequestSchema, type SyncData, type SyncRequest, type SyncResponse } from '@/domain/syncProtocol.ts'

export function noop(): void {}

export function emptySyncData(): SyncData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tasks: [], task_events: [], people: [], notes: [] }
}

/**
 * Reusa o `computeChecksum` DE VERDADE (nao uma reimplementacao paralela):
 * um servidor de mentira que calcula o checksum com uma logica levemente
 * diferente da real nunca bateria com o que o motor espera, mesmo para o
 * mesmo conteudo - e foi exatamente isso que aconteceu na primeira versao
 * deste teste (o helper daqui nao ordenava as chaves do nivel raiz, so as
 * de dentro de cada tarefa). `includeNotes: false` simula o calculo de um
 * script ANTERIOR a extensao "Anotações" (docs/prompt-anotacoes.md secao
 * 1.6) - ver `createFakeServer({ legacy: true })`.
 */
export function canonicalChecksum(d: SyncData, includeNotes = true): Promise<string> {
  return computeChecksum(
    { tasks: d.tasks, taskEvents: d.task_events, people: d.people, notes: d.notes },
    includeNotes,
  )
}

export interface FakeServerOptions {
  /**
   * Simula um `Code.gs` publicado ANTES da extensão "Anotações" - nunca
   * devolve `capabilities`, recusa a ação `status`, e calcula o checksum
   * sem a chave `notes` (ver `src/sync/engine.ts`, detecção por
   * `pulled.capabilities?.notes`).
   */
  readonly legacy?: boolean
}

/**
 * Servidor Apps Script simulado, em memoria: implementa ping/status/pull/
 * push com as mesmas regras de `apps-script/Code.gs` (conferir
 * baseRevision, gerar checksum da mesma forma), interceptando
 * `global.fetch`. Nao reusa `apps-script/test/harness.mjs` porque aquele
 * carrega o `.gs` via `vm` simulando os globais do Apps Script - aqui o
 * alvo e o `callSync` do front, entao o suficiente e simular as RESPOSTAS
 * HTTP.
 */
export function createFakeServer(token: string, options: FakeServerOptions = {}) {
  const legacy = options.legacy === true
  let revision = 0
  let data: SyncData = emptySyncData()

  async function handle(body: SyncRequest): Promise<SyncResponse> {
    if (body.token !== token) return { ok: false, error: 'unauthorized' }

    if (body.action === 'status') {
      if (legacy) return { ok: false, error: 'invalid' }
      return { ok: true, revision, checksum: await canonicalChecksum(data), capabilities: { notes: true, status: true } }
    }

    if (body.action === 'ping' || body.action === 'pull') {
      return {
        ok: true,
        revision,
        checksum: await canonicalChecksum(data, !legacy),
        data,
        ...(legacy ? {} : { capabilities: { notes: true, status: true } }),
      }
    }

    if (body.data === undefined || body.baseRevision !== revision) {
      return { ok: false, error: body.data === undefined ? 'invalid' : 'conflict' }
    }
    data = body.data
    revision += 1
    return {
      ok: true,
      revision,
      checksum: await canonicalChecksum(data, !legacy),
      data,
      ...(legacy ? {} : { capabilities: { notes: true, status: true } }),
    }
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
export function createFakeLocalStorage(): Storage {
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
