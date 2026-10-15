/**
 * `meta`: a unica linha de estado so-local (docs secao 10) - nunca
 * sincronizada. Guarda o nome do aparelho, a ultima revisao/checksum
 * confirmados e os ids pendentes de confirmacao (o contador sempre visivel
 * da docs secao 6.3).
 */
import { CURRENT_SCHEMA_VERSION, type Meta } from '@/domain/schema.ts'
import { getDeviceName } from './device.ts'
import { LOCAL_META_KEY, type MatrizDB } from './schema.ts'

function defaultMeta(): Meta {
  return {
    device_name: getDeviceName(),
    last_confirmed_revision: null,
    last_confirmed_checksum: null,
    pending_ids: [],
    schema_version: CURRENT_SCHEMA_VERSION,
  }
}

export async function getMeta(db: MatrizDB): Promise<Meta> {
  const existing = await db.meta.get(LOCAL_META_KEY)
  return existing ?? defaultMeta()
}

/**
 * Marca um id como pendente de confirmacao. Chamada de DENTRO da mesma
 * transacao Dexie da escrita que a gerou (os repositorios de tarefa passam
 * `db.meta` na lista de tabelas da transacao) - senao duas escritas quase
 * simultaneas poderiam ler o mesmo "antes" e uma pisar na marca pendente da
 * outra.
 */
export async function markPendingInTx(db: MatrizDB, taskId: string): Promise<void> {
  const current = await getMeta(db)
  if (current.pending_ids.includes(taskId)) return
  await db.meta.put({ ...current, pending_ids: [...current.pending_ids, taskId] }, LOCAL_META_KEY)
}

/** Usado so por `discardTask` (desfazer uma colagem multilinha): a tarefa nunca existiu de verdade. */
export async function unmarkPendingInTx(db: MatrizDB, taskId: string): Promise<void> {
  const current = await getMeta(db)
  if (!current.pending_ids.includes(taskId)) return
  await db.meta.put(
    { ...current, pending_ids: current.pending_ids.filter((id) => id !== taskId) },
    LOCAL_META_KEY,
  )
}

/**
 * Limpa a pendencia e registra a revisao/checksum confirmados - so depois
 * da releitura e comparacao de checksum (docs secao 6.1, passo 4 e 5).
 * Nao limpa dentro de uma transacao com a escrita de tarefas, porque e
 * chamada pelo motor de sync depois de todo o ciclo pull-mesclar-push-
 * reler terminar, nao durante uma unica escrita local.
 */
export async function clearPending(
  db: MatrizDB,
  confirmedRevision: number,
  confirmedChecksum: string,
): Promise<void> {
  const current = await getMeta(db)
  await db.meta.put(
    {
      ...current,
      pending_ids: [],
      last_confirmed_revision: confirmedRevision,
      last_confirmed_checksum: confirmedChecksum,
    },
    LOCAL_META_KEY,
  )
}
