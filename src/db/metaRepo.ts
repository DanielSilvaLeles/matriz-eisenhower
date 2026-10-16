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
    last_confirmed_at: null,
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
 * Limpa SO os ids que este ciclo de sync realmente confirmou - nunca a
 * lista inteira de pendencias. `confirmedIds` e o `pending_ids` de quando o
 * ciclo começou (lido no mesmo instante de `readLocalState`, em
 * `src/sync/engine.ts`): tudo que foi marcado pendente DEPOIS desse
 * instante (uma edição feita enquanto o ciclo estava em voo) não foi
 * sincronizado ainda e tem que continuar aparecendo como pendente -
 * limpar a lista inteira aqui apagaria essa marca por engano, fazendo o
 * contador mentir que está tudo confirmado quando não está (docs secao
 * 6.3: "o estado da sincronização é sempre visível e honesto").
 *
 * Dentro de uma transação (leitura + escrita juntas): sem isso, uma
 * `markPendingInTx` de outra escrita concorrente podia acontecer BEM no
 * meio do intervalo entre o `getMeta` e o `put` daqui, e o `put` sobrescrevia
 * essa marca nova com um valor calculado a partir de uma leitura já
 * desatualizada - o mesmo tipo de corrida que motivou o `bulkPut` em
 * `applyMergedState`.
 */
export async function clearPending(
  db: MatrizDB,
  confirmedRevision: number,
  confirmedChecksum: string,
  confirmedIds: readonly string[],
  confirmedAt: string,
): Promise<void> {
  const confirmedSet = new Set(confirmedIds)
  await db.transaction('rw', db.meta, async () => {
    const current = await getMeta(db)
    await db.meta.put(
      {
        ...current,
        pending_ids: current.pending_ids.filter((id) => !confirmedSet.has(id)),
        last_confirmed_revision: confirmedRevision,
        last_confirmed_checksum: confirmedChecksum,
        last_confirmed_at: confirmedAt,
      },
      LOCAL_META_KEY,
    )
  })
}
