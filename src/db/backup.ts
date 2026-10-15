/**
 * Exportar e importar backup (docs secao 5.8): a rede de seguranca caso o
 * Drive ou o script de sincronizacao falhem (fase 2). Funciona mesmo sem
 * nenhuma sincronizacao configurada - e o unico jeito de levar os dados de
 * um aparelho para o outro ate a fase 2 existir.
 */
import type { Backup, BackupContents } from '@/domain/backup.ts'
import { buildBackup } from '@/domain/backup.ts'
import type { MatrizDB } from './schema.ts'

export async function exportBackup(db: MatrizDB): Promise<Backup> {
  const [tasks, taskEvents, people] = await Promise.all([
    db.tasks.toArray(),
    db.task_events.toArray(),
    db.people.toArray(),
  ])

  const contents: BackupContents = { tasks, taskEvents, people }
  return buildBackup(contents, new Date().toISOString())
}

export interface ImportCounts {
  readonly tasks: number
  readonly taskEvents: number
  readonly people: number
}

/** Quantos registros existem agora, para a pre-visualizacao "isto vai ser substituido". */
export async function currentCounts(db: MatrizDB): Promise<ImportCounts> {
  const [tasks, taskEvents, people] = await Promise.all([
    db.tasks.count(),
    db.task_events.count(),
    db.people.count(),
  ])
  return { tasks, taskEvents, people }
}

/**
 * Substitui TODO o conteudo das tres tabelas pelo do backup, numa unica
 * transacao - ou importa tudo, ou (se algo falhar) nao muda nada.
 */
export function applyBackup(db: MatrizDB, backup: Backup): Promise<void> {
  return db.transaction('rw', db.tasks, db.task_events, db.people, async () => {
    await Promise.all([db.tasks.clear(), db.task_events.clear(), db.people.clear()])
    await Promise.all([
      db.tasks.bulkAdd(backup.tasks),
      db.task_events.bulkAdd(backup.task_events),
      db.people.bulkAdd(backup.people),
    ])
  })
}
