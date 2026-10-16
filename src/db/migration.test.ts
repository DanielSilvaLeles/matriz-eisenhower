import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import DexieDB from 'dexie'
import { MatrizDB, LOCAL_META_KEY } from './schema.ts'

/**
 * Migração v1 → v2 (extensão "Anotações", `docs/prompt-anotacoes.md` seção
 * 1.6: "a migration do banco local... deve ter teste com dados no formato
 * ATUAL (fixtures), provando que tarefas, pessoas e histórico existentes
 * sobrevivem intactos"). Abre um banco SÓ com a versão 1 (como um
 * instalação antiga faria), grava dados no formato v1 exato (tarefa SEM
 * `source_note_id`), fecha, e reabre com a classe real `MatrizDB` (que
 * declara v1 e v2) - é exatamente o caminho que o Dexie percorre de
 * verdade num aparelho que atualiza o app.
 */

const DB_NAME_PREFIX = 'teste-migracao'

function openV1Database(name: string): DexieDB {
  const db = new DexieDB(name)
  db.version(1).stores({
    tasks: 'id, quadrant, status, [quadrant+status], updated_at, deleted',
    task_events: 'id, task_id, at',
    people: 'id, name',
    meta: '',
  })
  return db
}

const V1_TASK = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Revisar PR do time',
  notes: 'Comentário antigo',
  quadrant: 'q1',
  status: 'open',
  position: 1000,
  date: null,
  delegated_to: null,
  delegation_context: null,
  expected_outcome: null,
  tags: ['projeto'],
  source: 'web',
  context: 'work',
  created_at: '2026-01-10T09:00:00.000Z',
  updated_at: '2026-01-10T09:00:00.000Z',
  completed_at: null,
  deleted: false,
  device: 'pc empresa',
  // SEM source_note_id - exatamente o formato que uma instalação de antes
  // desta extensão tem gravado no IndexedDB.
}

const V1_EVENT = {
  id: '22222222-2222-4222-8222-222222222222',
  task_id: V1_TASK.id,
  type: 'created',
  from_quadrant: null,
  to_quadrant: 'q1',
  at: '2026-01-10T09:00:00.000Z',
  device: 'pc empresa',
}

const V1_PERSON = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Fulano de Tal',
  updated_at: '2026-01-10T09:00:00.000Z',
}

const V1_META = {
  device_name: 'pc empresa',
  last_confirmed_revision: 5,
  last_confirmed_checksum: 'abc123',
  pending_ids: [],
  schema_version: 1,
}

let dbName: string

beforeEach(() => {
  dbName = `${DB_NAME_PREFIX}-${crypto.randomUUID()}`
})

afterEach(async () => {
  await new MatrizDB(dbName).delete()
})

describe('migração v1 → v2 (tabela notes, tasks.source_note_id)', () => {
  it('tarefa v1 (sem source_note_id) sobrevive intacta e ganha o campo novo como null', async () => {
    const v1 = openV1Database(dbName)
    await v1.table('tasks').add(V1_TASK)
    await v1.table('task_events').add(V1_EVENT)
    await v1.table('people').add(V1_PERSON)
    await v1.table('meta').put(V1_META, LOCAL_META_KEY)
    v1.close()

    const v2 = new MatrizDB(dbName)
    await v2.open()

    const migratedTask = await v2.tasks.get(V1_TASK.id)
    expect(migratedTask).toMatchObject({
      ...V1_TASK,
      source_note_id: null,
    })

    v2.close()
  })

  it('task_events e people sobrevivem sem nenhuma mudança', async () => {
    const v1 = openV1Database(dbName)
    await v1.table('tasks').add(V1_TASK)
    await v1.table('task_events').add(V1_EVENT)
    await v1.table('people').add(V1_PERSON)
    await v1.table('meta').put(V1_META, LOCAL_META_KEY)
    v1.close()

    const v2 = new MatrizDB(dbName)
    await v2.open()

    expect(await v2.task_events.get(V1_EVENT.id)).toEqual(V1_EVENT)
    expect(await v2.people.get(V1_PERSON.id)).toEqual(V1_PERSON)

    v2.close()
  })

  it('meta (pendências, revisão/checksum confirmados) sobrevive sem nenhuma mudança', async () => {
    const v1 = openV1Database(dbName)
    await v1.table('meta').put(V1_META, LOCAL_META_KEY)
    v1.close()

    const v2 = new MatrizDB(dbName)
    await v2.open()

    expect(await v2.meta.get(LOCAL_META_KEY)).toEqual(V1_META)

    v2.close()
  })

  it('a tabela notes nasce vazia e pronta para uso - nenhuma anotação existia antes desta versão', async () => {
    const v1 = openV1Database(dbName)
    await v1.table('tasks').add(V1_TASK)
    v1.close()

    const v2 = new MatrizDB(dbName)
    await v2.open()

    expect(await v2.notes.count()).toBe(0)

    v2.close()
  })

  it('varias tarefas v1 migram juntas, cada uma com source_note_id null', async () => {
    const v1 = openV1Database(dbName)
    await v1.table('tasks').bulkAdd([
      V1_TASK,
      { ...V1_TASK, id: 'aaaaaaaa-1111-4111-8111-111111111111', quadrant: 'q2' },
      { ...V1_TASK, id: 'bbbbbbbb-1111-4111-8111-111111111111', quadrant: null },
    ])
    v1.close()

    const v2 = new MatrizDB(dbName)
    await v2.open()

    const tasks = await v2.tasks.toArray()
    expect(tasks).toHaveLength(3)
    expect(tasks.every((task) => task.source_note_id === null)).toBe(true)

    v2.close()
  })

  it('um banco criado direto na v2 (instalação nova) também funciona, sem passar pela migração', async () => {
    const db = new MatrizDB(dbName)
    await db.open()

    expect(await db.tasks.count()).toBe(0)
    expect(await db.notes.count()).toBe(0)

    db.close()
  })
})
