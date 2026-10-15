/**
 * Leitura e aplicacao do estado completo para o motor de sync
 * (src/sync/engine.ts) - o unico lugar, alem do backup, que mexe nas tres
 * tabelas de uma vez.
 */
import type { SyncableState } from '@/domain/merge.ts'
import type { MatrizDB } from './schema.ts'

export async function readLocalState(db: MatrizDB): Promise<SyncableState> {
  const [tasks, taskEvents, people] = await Promise.all([
    db.tasks.toArray(),
    db.task_events.toArray(),
    db.people.toArray(),
  ])
  return { tasks, taskEvents, people }
}

/**
 * Substitui as tres tabelas pelo estado mesclado - numa unica transacao,
 * para nunca deixar o banco local com tarefas de um momento e eventos de
 * outro. Nao mexe em `meta`: quem limpa a pendencia e confirma a revisao e
 * o motor de sync, so depois da verificacao (docs secao 6.1, passos 4 e 5).
 */
export function applyMergedState(db: MatrizDB, merged: SyncableState): Promise<void> {
  return db.transaction('rw', db.tasks, db.task_events, db.people, async () => {
    await Promise.all([db.tasks.clear(), db.task_events.clear(), db.people.clear()])
    await Promise.all([
      db.tasks.bulkAdd(merged.tasks),
      db.task_events.bulkAdd(merged.taskEvents),
      db.people.bulkAdd(merged.people),
    ])
  })
}
