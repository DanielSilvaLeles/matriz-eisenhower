import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta } from '@/db/metaRepo.ts'
import { MatrizDB } from '@/db/schema.ts'
import { addTaskToQuadrant, moveTaskToQuadrant } from '@/db/tasksRepo.ts'
import { syncRequestSchema } from '@/domain/syncProtocol.ts'
import { createFakeLocalStorage, createFakeServer, noop } from './engine.testHelpers.ts'
import { setSyncToken, setSyncUrl } from './config.ts'
import { runSync } from './engine.ts'

/**
 * Dois bugs reais relatados em produção, ambos sobre uma escrita local
 * acontecendo ENQUANTO um ciclo de sync (pull -> mesclar -> push ->
 * verificacao, um tempo real de rede) ja esta em voo - `readLocalState` lê
 * o snapshot no INÍCIO do ciclo, e qualquer escrita local depois desse
 * instante corre o risco de ser pisada quando o ciclo volta pra gravar o
 * resultado. Ver `applyAndConfirm` em `engine.ts` pro raciocínio completo
 * da correção (reler o estado local de novo bem antes de gravar e
 * mesclar com o resultado do ciclo pela mesma regra de "vence o
 * updated_at mais recente" usada em todo o resto do app).
 */

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-sync-race-${crypto.randomUUID()}`)
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

// Mesma configuracao de `engine.test.ts` - ver o comentario la pro porque.
vi.mock('@/db/schema.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/schema.ts')>()
  return {
    ...actual,
    getDB: () => db,
  }
})

describe('runSync - corridas com escrita local durante o ciclo', () => {
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

  it('mover uma tarefa JA EXISTENTE durante o ciclo (apos o snapshot) nao e desfeito', async () => {
    // Regressao de um segundo bug real relatado em produção, mais sutil
    // que o anterior: ali uma tarefa NOVA (ausente do snapshot) sobrevivia
    // graças ao `bulkPut` - `applyMergedState` nunca toca um id que nao
    // esta em `merged`. Mas uma tarefa JA EXISTENTE no snapshot (so que
    // movida DEPOIS dele) tem seu id presente em `merged` mesmo assim - só
    // que com o quadrante ANTIGO. `bulkPut(merged.tasks)` sobrescrevia
    // esse id de volta pro valor desatualizado, desfazendo o movimento
    // silenciosamente assim que o ciclo terminava. Corrigido relendo o
    // estado local de novo logo antes de gravar e mesclando com `merged`
    // pela mesma regra de "vence o updated_at mais recente" usada em todo
    // o resto do app (`applyAndConfirm` em engine.ts).
    const server = createFakeServer('segredo')
    const task = await addTaskToQuadrant(db, 'q1', 'Tarefa que vai ser movida')

    // Sincroniza uma vez pra essa tarefa ja estar "confirmada" no servidor
    // - o cenario do usuario e mover uma tarefa estavel, nao uma recem-
    // criada no mesmo ciclo (esse caso ja tem teste proprio acima).
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')
    await runSync()
    expect((await getMeta(db)).pending_ids).toEqual([])

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

    // Dispara outro ciclo (ex.: o gatilho periodico) com algo pra empurrar,
    // senao o motor pega o atalho "nada para enviar" e nunca chama push -
    // uma segunda tarefa qualquer basta pra isso.
    await addTaskToQuadrant(db, 'q1', 'Outra tarefa, so pra ter algo a enviar')

    const syncPromise = runSync()

    // Espera o ciclo chegar ao push (snapshot do estado local ja foi lido).
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => {
        const parsed = syncRequestSchema.parse(JSON.parse(call[1].body))
        return parsed.action === 'push'
      })).toBe(true)
    })

    // Move a tarefa JA EXISTENTE DEPOIS do snapshot - a mesma corrida
    // relatada em produção ("movimento um item... durante a sincronização,
    // ele volta para o quadrante anterior").
    await moveTaskToQuadrant(db, task.id, 'q2')

    releasePush()
    await syncPromise

    const moved = await db.tasks.get(task.id)
    expect(moved?.quadrant).toBe('q2')

    // O movimento nao fazia parte do que foi enviado neste ciclo - continua
    // pendente pro proximo ciclo empurrar de verdade, em vez do contador
    // mentir que ja esta tudo confirmado.
    const meta = await getMeta(db)
    expect(meta.pending_ids).toContain(task.id)
  })
})
