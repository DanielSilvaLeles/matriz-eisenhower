import 'fake-indexeddb/auto'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta } from '@/db/metaRepo.ts'
import { MatrizDB } from '@/db/schema.ts'
import { addTaskToQuadrant } from '@/db/tasksRepo.ts'
import { createNoteWithContent, editNoteFields } from '@/db/notesRepo.ts'
import { createFakeLocalStorage, createFakeServer } from './engine.testHelpers.ts'
import { setSyncToken, setSyncUrl } from './config.ts'
import { runSync, scriptCapabilityStore, syncStatusStore } from './engine.ts'

/** So pra inspecionar a chave `notes` no JSON de verdade - nunca atraves do
 * `syncRequestSchema` (seu `.default([])` sempre preenche `notes`, mesmo
 * quando a chave estava ausente de verdade no corpo). */
const rawPushBodySchema = z.object({
  action: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
})

function pushBodyFromCall(call: [string, { body: string }]): { readonly action: string; readonly hasNotesKey: boolean } | null {
  const parsed = rawPushBodySchema.safeParse(JSON.parse(call[1].body))
  if (!parsed.success) return null
  return { action: parsed.data.action, hasNotesKey: parsed.data.data !== undefined && 'notes' in parsed.data.data }
}

/**
 * Cobertura da extensão "Anotações" no motor de sync de verdade (não so na
 * função pura `detectNoteConflicts` - `noteMerge.test.ts` já cobre essa):
 * uma anotação sincroniza como uma tarefa, e o pre-check `status` pula o
 * ciclo completo quando nada mudou. Separado de `engine.test.ts` por
 * assunto (nao so pelo limite de linhas), mesma configuracao de teste.
 */

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-sync-notes-${crypto.randomUUID()}`)
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

vi.mock('@/db/schema.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/schema.ts')>()
  return {
    ...actual,
    getDB: () => db,
  }
})

describe('runSync - anotações', () => {
  it('uma anotação nova sincroniza como uma tarefa: fica "confirmed" e limpa a pendência', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await createNoteWithContent(db, crypto.randomUUID(), 'Texto da reunião de hoje')
    expect((await getMeta(db)).pending_ids).toHaveLength(1)

    await runSync()

    expect(syncStatusStore.get().kind).toBe('confirmed')
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([])

    const notes = await db.notes.toArray()
    expect(notes).toHaveLength(1)
    expect(notes[0]?.body).toBe('Texto da reunião de hoje')
  })

  it('edição concorrente genuína de anotação gera cópia de conflito, sem perder nenhum texto', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    const note = await createNoteWithContent(db, crypto.randomUUID(), 'Versão original')
    await runSync()
    expect((await getMeta(db)).pending_ids).toEqual([])

    // "Outro aparelho" edita a MESMA anotação e empurra primeiro.
    await server.fetchMock(server.url, {
      body: JSON.stringify({
        token: 'segredo',
        action: 'push',
        baseRevision: server.revisionNow(),
        data: {
          schemaVersion: 2,
          tasks: [],
          task_events: [],
          people: [],
          // +1s: garante um `updated_at` estritamente depois do
          // `last_confirmed_at` que o primeiro `runSync()` acabou de
          // gravar - sem essa folga, os dois timestamps podem cair no
          // mesmo milissegundo num teste que roda rápido o bastante, e
          // `remote.updated_at > lastConfirmedAt` (igualdade não conta)
          // deixaria de detectar o conflito por pura coincidência de
          // relógio, não por nenhum bug de verdade.
          notes: [
            {
              ...note,
              body: 'Editado no celular',
              device: 'celular',
              updated_at: new Date(Date.now() + 1000).toISOString(),
            },
          ],
        },
      }),
    })

    // Este aparelho edita a MESMA anotação, sem saber da edição remota -
    // fica pendente de novo.
    await editNoteFields(db, note.id, { body: 'Editado no pc empresa' })
    expect((await getMeta(db)).pending_ids).toContain(note.id)

    await runSync()

    expect(syncStatusStore.get().kind).toBe('confirmed')
    const notes = await db.notes.toArray()
    // Duas anotações agora: a vencedora no id original, e uma cópia de
    // conflito nova com o texto perdedor - NENHUM dos dois textos foi
    // descartado.
    expect(notes).toHaveLength(2)
    const bodies = notes.map((n) => n.body).toSorted()
    expect(bodies).toEqual(['Editado no celular', 'Editado no pc empresa'])
    const copy = notes.find((n) => n.id !== note.id)
    expect(copy?.title).toContain('conflito')
  })

  it('status: sem nada pendente e servidor sem mudanca, pula o ciclo completo (so 1 chamada de rede)', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Tarefa estavel')
    await runSync()
    expect((await getMeta(db)).pending_ids).toEqual([])

    server.fetchMock.mockClear()
    await runSync()

    // So a chamada de `status` - nunca chegou a puxar o arquivo inteiro,
    // porque nada pendente aqui e nada mudou no servidor desde a ultima
    // sincronizacao confirmada (docs/prompt-anotacoes.md secao 6.3).
    expect(server.fetchMock.mock.calls).toHaveLength(1)
    expect(syncStatusStore.get().kind).toBe('confirmed')
  })

  it('status: mesmo sem pendencia local, se o servidor mudou desde a ultima confirmacao, roda o ciclo completo', async () => {
    const server = createFakeServer('segredo')
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Tarefa estavel')
    await runSync()
    expect((await getMeta(db)).pending_ids).toEqual([])

    // "Outro aparelho" empurra uma mudanca depois da nossa ultima confirmacao.
    await server.fetchMock(server.url, {
      body: JSON.stringify({
        token: 'segredo',
        action: 'push',
        baseRevision: server.revisionNow(),
        data: {
          schemaVersion: 2,
          tasks: [],
          task_events: [],
          people: [],
          notes: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              title: null,
              body: 'Anotação de outro aparelho',
              tags: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted: false,
              deleted_at: null,
              device: 'celular',
            },
          ],
        },
      }),
    })

    await runSync()

    const notes = await db.notes.toArray()
    expect(notes.map((n) => n.body)).toContain('Anotação de outro aparelho')
  })
})

/**
 * Compatibilidade com o script antigo (docs/prompt-anotacoes.md secao
 * 1.6) - "o app novo precisa funcionar com ele": tarefas continuam
 * sincronizando normalmente, anotações ficam só locais (sempre pendentes,
 * nunca enviadas), e o app detecta e avisa em vez de falhar.
 */
describe('runSync - compatibilidade com script antigo (sem a extensão "Anotações")', () => {
  it('tarefas sincronizam normalmente; anotações continuam só locais e pendentes, com aviso', async () => {
    const server = createFakeServer('segredo', { legacy: true })
    vi.stubGlobal('fetch', server.fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Tarefa normal')
    const note = await createNoteWithContent(db, crypto.randomUUID(), 'Anotação que não pode sincronizar ainda')

    await runSync()

    expect(syncStatusStore.get().kind).toBe('confirmed')
    expect(scriptCapabilityStore.get()).toEqual({ notesSupported: false })

    // A tarefa sincronizou (revisão avançou, nada ficou pendente para ela).
    expect(server.revisionNow()).toBeGreaterThan(0)
    const meta = await getMeta(db)
    expect(meta.pending_ids).toEqual([note.id])

    // A anotação nunca saiu deste aparelho - o servidor de mentira nem
    // sabe que ela existe.
    const allPushesOmitNotes = server.fetchMock.mock.calls.every((call) => {
      const parsed = pushBodyFromCall(call)
      return parsed === null || parsed.action !== 'push' || !parsed.hasNotesKey
    })
    expect(allPushesOmitNotes).toBe(true)
  })

  it('nunca inclui a chave `notes` no corpo do push contra um script antigo', async () => {
    const server = createFakeServer('segredo', { legacy: true })
    const fetchMock = vi.fn(server.fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    setSyncUrl(server.url)
    setSyncToken('segredo')

    await addTaskToQuadrant(db, 'q1', 'Tarefa normal')
    await runSync()

    const pushCall = fetchMock.mock.calls.find((call) => pushBodyFromCall(call)?.action === 'push')
    expect(pushCall).toBeDefined()
    expect(pushBodyFromCall(pushCall!)?.hasNotesKey).toBe(false)
  })

  it('depois que o script e reimplantado (ganha capabilities), a anotação pendente finalmente sincroniza', async () => {
    const legacyServer = createFakeServer('segredo', { legacy: true })
    vi.stubGlobal('fetch', legacyServer.fetchMock)
    setSyncUrl(legacyServer.url)
    setSyncToken('segredo')

    const note = await createNoteWithContent(db, crypto.randomUUID(), 'Esperando o script atualizar')
    await runSync()
    expect((await getMeta(db)).pending_ids).toEqual([note.id])

    // "Reimplanta" o script: mesmo estado (tasks/events/people), agora
    // com capabilities. Simulado troubleshooting um novo servidor de
    // mentira ja na revisao atual, com a mesma anotação local ainda
    // pendente (nunca foi gravada no servidor antigo).
    const upgradedServer = createFakeServer('segredo')
    vi.stubGlobal('fetch', upgradedServer.fetchMock)

    await runSync()

    expect(scriptCapabilityStore.get()).toEqual({ notesSupported: true })
    expect((await getMeta(db)).pending_ids).toEqual([])
    const notes = await db.notes.toArray()
    expect(notes.map((n) => n.body)).toContain('Esperando o script atualizar')
  })
})
