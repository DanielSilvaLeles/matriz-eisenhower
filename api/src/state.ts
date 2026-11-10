/**
 * Leitura e gravação do documento inteiro - a mesma semântica que o Code.gs
 * dava ao `matriz.json`, agora em tabelas:
 *
 * - `readDocument`: estado + checksum calculado das linhas de verdade.
 * - `pushDocument`: numa transação só - trava `sync_state` (`FOR UPDATE`),
 *   confere `baseRevision` DENTRO da trava, recusa encolhimento drástico sem
 *   `allowShrink`, guarda a versão anterior em `sync_snapshots` (os antigos
 *   bak1/bak2), faz upsert de cada entidade e apaga o que não veio (a
 *   limpeza de tombstone de 30 dias do front tira itens do documento), e só
 *   então sobe a revisão. Releitura + checksum no fim, ainda na transação.
 */
import { computeChecksum, type SyncData } from './checksum.ts'
import { pgErrorCode, type Pool, type PoolClient } from './db.ts'
import { ENTITIES, itemToRecord, rowToItem, sqlType, type Entity } from './entities.ts'

/** Mesmo limiar do Code.gs (`SHRINK_THRESHOLD`). */
const SHRINK_THRESHOLD = 0.5
/** Quantas versões anteriores guardar (bak1 + bak2). */
const SNAPSHOTS_KEPT = 2
const LOCK_TIMEOUT = '10s'

export interface Document {
  readonly revision: number
  readonly checksum: string
  readonly data: SyncData
}

export type PushResult =
  | ({ readonly ok: true } & Document)
  | { readonly ok: false; readonly error: 'conflict' | 'invalid' | 'busy' }

type Queryable = Pick<PoolClient, 'query'>

interface StateRow {
  revision: number
  checksum: string | null
  schema_version: number
}

async function readStateRow(db: Queryable, forUpdate = false): Promise<StateRow> {
  const result = await db.query<StateRow>(
    `SELECT revision, checksum, schema_version FROM sync_state WHERE id = 1${forUpdate ? ' FOR UPDATE' : ''}`,
  )
  const row = result.rows[0]
  if (!row) throw new Error('sync_state sem a linha id=1 - migration 001 não rodou?')
  return row
}

async function readEntity(db: Queryable, entity: Entity): Promise<Record<string, unknown>[]> {
  const columns = [...entity.columns.map((c) => c.name), 'extra'].join(', ')
  const result = await db.query<Record<string, unknown>>(`SELECT ${columns} FROM ${entity.name} ORDER BY id`)
  return result.rows.map((row) => rowToItem(entity, row))
}

async function readData(db: Queryable, schemaVersion: number): Promise<SyncData> {
  // Em sequência, não Promise.all: é um client só (uma transação), e o pg
  // não aceita consultas paralelas no mesmo client.
  const data: SyncData = { schemaVersion, tasks: [], task_events: [], people: [], notes: [] }
  for (const entity of ENTITIES) {
    data[entity.name] = await readEntity(db, entity)
  }
  return data
}

export async function readDocument(pool: Pool): Promise<Document> {
  const client = await pool.connect()
  try {
    // REPEATABLE READ: as cinco leituras enxergam o mesmo instante, nunca
    // metade de um push concorrente.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const state = await readStateRow(client)
    const data = await readData(client, state.schema_version)
    await client.query('COMMIT')
    return { revision: state.revision, checksum: computeChecksum(data), data }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

/** Barato: só a linha de `sync_state` (o checksum foi gravado no push). */
export async function readStatus(pool: Pool): Promise<{ revision: number; checksum: string }> {
  const state = await readStateRow(pool)
  if (state.checksum !== null) return { revision: state.revision, checksum: state.checksum }
  // Só antes do primeiro push/importação (revisão 0, banco vazio).
  const doc = await readDocument(pool)
  return { revision: doc.revision, checksum: doc.checksum }
}

function isDrasticShrink(before: number, after: number): boolean {
  if (before === 0) return false
  return after < before * SHRINK_THRESHOLD
}

async function upsertEntity(db: Queryable, entity: Entity, items: readonly Record<string, unknown>[]): Promise<void> {
  const names = entity.columns.map((c) => c.name)
  const all = [...names, 'extra']
  const recordDef = [...entity.columns.map((c) => `${c.name} ${sqlType(c)}`), 'extra jsonb'].join(', ')
  const updatable = all.filter((n) => n !== 'id')

  if (items.length > 0) {
    // `IS DISTINCT FROM` na tupla inteira: uma linha que veio igual não é
    // tocada, e o trigger de `server_updated_at` só dispara em mudança real
    // (o push manda o documento inteiro, toda vez).
    await db.query(
      `INSERT INTO ${entity.name} (${all.join(', ')})
       SELECT ${all.join(', ')} FROM jsonb_to_recordset($1::jsonb) AS x(${recordDef})
       ON CONFLICT (id) DO UPDATE SET ${updatable.map((n) => `${n} = EXCLUDED.${n}`).join(', ')}
       WHERE (${updatable.map((n) => `${entity.name}.${n}`).join(', ')})
         IS DISTINCT FROM (${updatable.map((n) => `EXCLUDED.${n}`).join(', ')})`,
      [JSON.stringify(items.map((item) => itemToRecord(entity, item)))],
    )
  }
  await db.query(`DELETE FROM ${entity.name} WHERE NOT (id = ANY($1::uuid[]))`, [items.map((item) => item['id'])])
}

export interface PushRequest {
  readonly baseRevision: number
  readonly data: SyncData
  readonly allowShrink: boolean
}

export async function pushDocument(pool: Pool, request: PushRequest): Promise<PushResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`)
    const state = await readStateRow(client, true)

    if (state.revision !== request.baseRevision) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'conflict' }
    }

    const current = await readData(client, state.schema_version)
    if (
      !request.allowShrink &&
      (isDrasticShrink(current.tasks.length, request.data.tasks.length) ||
        isDrasticShrink(current.notes.length, request.data.notes.length))
    ) {
      await client.query('ROLLBACK')
      console.error(
        `[matriz-api] push recusado por encolher demais sem allowShrink: ` +
          `${current.tasks.length}→${request.data.tasks.length} tarefas, ` +
          `${current.notes.length}→${request.data.notes.length} anotações`,
      )
      return { ok: false, error: 'invalid' }
    }

    if (state.revision > 0) {
      await client.query(
        `INSERT INTO sync_snapshots (revision, checksum, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (revision) DO NOTHING`,
        [state.revision, state.checksum, JSON.stringify(current)],
      )
      await client.query(
        `DELETE FROM sync_snapshots WHERE revision NOT IN
           (SELECT revision FROM sync_snapshots ORDER BY revision DESC LIMIT $1)`,
        [SNAPSHOTS_KEPT],
      )
    }

    for (const entity of ENTITIES) {
      await upsertEntity(client, entity, request.data[entity.name])
    }

    const saved = await readData(client, request.data.schemaVersion)
    const checksum = computeChecksum(saved)
    const revision = state.revision + 1
    await client.query('UPDATE sync_state SET revision = $1, checksum = $2, schema_version = $3 WHERE id = 1', [
      revision,
      checksum,
      request.data.schemaVersion,
    ])
    await client.query('COMMIT')
    return { ok: true, revision, checksum, data: saved }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    const code = pgErrorCode(error)
    // 55P03 lock_not_available: outro push segurando a trava além do
    // lock_timeout - o mesmo "busy" que o LockService.tryLock dava.
    if (code === '55P03') return { ok: false, error: 'busy' }
    // Classe 22 (dado inválido: NUL em texto, número fora de faixa...) e 23
    // (restrição: CHECK, NOT NULL, unicidade) - culpa do payload, não do
    // servidor.
    if (code !== null && (code.startsWith('22') || code.startsWith('23'))) {
      console.error(`[matriz-api] push recusado pelo banco (${code}): ${error instanceof Error ? error.message : ''}`)
      return { ok: false, error: 'invalid' }
    }
    throw error
  } finally {
    client.release()
  }
}

/**
 * Grava um documento inteiro numa revisão específica, sem conferir
 * `baseRevision` nem encolhimento - usado só pela importação do JSON do
 * Drive (`scripts/import.ts`), que precisa preservar a revisão de lá para os
 * aparelhos não verem conflito na virada. Idempotente: rodar de novo com o
 * mesmo arquivo não muda nada (upsert + mesma revisão).
 */
export async function replaceDocument(pool: Pool, revision: number, data: SyncData): Promise<Document> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await readStateRow(client, true)
    for (const entity of ENTITIES) {
      await upsertEntity(client, entity, data[entity.name])
    }
    const saved = await readData(client, data.schemaVersion)
    const checksum = computeChecksum(saved)
    await client.query('UPDATE sync_state SET revision = $1, checksum = $2, schema_version = $3 WHERE id = 1', [
      revision,
      checksum,
      data.schemaVersion,
    ])
    await client.query('COMMIT')
    return { revision, checksum, data: saved }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
