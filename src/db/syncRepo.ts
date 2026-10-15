/**
 * Leitura e aplicacao do estado completo para o motor de sync
 * (src/sync/engine.ts) - o unico lugar, alem do backup, que mexe nas tres
 * tabelas de uma vez.
 */
import { getMeta } from './metaRepo.ts'
import type { SyncableState } from '@/domain/merge.ts'
import type { MatrizDB } from './schema.ts'

export interface LocalSyncSnapshot extends SyncableState {
  /**
   * `meta.pending_ids` no MESMO instante das tarefas acima (uma unica
   * transacao de leitura) - para `clearPending` saber exatamente quais ids
   * este ciclo esta prestes a confirmar, sem incluir por engano uma
   * pendencia criada por uma escrita que aconteceu um instante depois.
   */
  readonly pendingIds: readonly string[]
}

export function readLocalState(db: MatrizDB): Promise<LocalSyncSnapshot> {
  return db.transaction('r', db.tasks, db.task_events, db.people, db.meta, async () => {
    const [tasks, taskEvents, people, meta] = await Promise.all([
      db.tasks.toArray(),
      db.task_events.toArray(),
      db.people.toArray(),
      getMeta(db),
    ])
    return { tasks, taskEvents, people, pendingIds: meta.pending_ids }
  })
}

/**
 * Grava o estado mesclado nas tres tabelas - numa unica transacao, para
 * nunca deixar o banco local com tarefas de um momento e eventos de outro.
 * Nao mexe em `meta`: quem limpa a pendencia e confirma a revisao e o motor
 * de sync, so depois da verificacao (docs secao 6.1, passos 4 e 5).
 *
 * `bulkPut` (grava por cima pelo id), NUNCA `clear()` antes - um ciclo de
 * sync inteiro (pull -> mesclar -> push -> reler) leva um tempo real de
 * rede, e `readLocalState` foi lido no COMEÇO desse tempo. Se a pessoa
 * criar ou editar uma tarefa enquanto o ciclo está em voo, essa escrita
 * grava no Dexie na hora (local-first) mas não está no `merged` que esse
 * ciclo está prestes a aplicar - um `clear()` aqui apagaria essa tarefa
 * sem nunca tê-la sincronizado. `bulkPut` só sobrescreve os ids que estão
 * em `merged`; o que entrou depois do snapshot fica intocado e pega o
 * próximo ciclo (bug real de perda de dado, relatado em produção e
 * corrigido aqui - ver CLAUDE.md).
 */
export function applyMergedState(db: MatrizDB, merged: SyncableState): Promise<void> {
  return db.transaction('rw', db.tasks, db.task_events, db.people, async () => {
    await Promise.all([
      db.tasks.bulkPut(merged.tasks),
      db.task_events.bulkPut(merged.taskEvents),
      db.people.bulkPut(merged.people),
    ])
  })
}
