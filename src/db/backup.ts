/**
 * Exportar e importar backup (docs secao 5.8): a rede de seguranca caso o
 * Drive ou o script de sincronizacao falhem (fase 2). Funciona mesmo sem
 * nenhuma sincronizacao configurada - e o unico jeito de levar os dados de
 * um aparelho para o outro ate a fase 2 existir.
 */
import type { Backup, BackupContents } from '@/domain/backup.ts'
import { buildBackup } from '@/domain/backup.ts'
import { notifyLocalWrite } from './changeSignal.ts'
import { getMeta } from './metaRepo.ts'
import { LOCAL_META_KEY, type MatrizDB } from './schema.ts'

export async function exportBackup(db: MatrizDB): Promise<Backup> {
  const [tasks, taskEvents, people, notes] = await Promise.all([
    db.tasks.toArray(),
    db.task_events.toArray(),
    db.people.toArray(),
    db.notes.toArray(),
  ])

  const contents: BackupContents = { tasks, taskEvents, people, notes }
  return buildBackup(contents, new Date().toISOString())
}

export interface ImportCounts {
  readonly tasks: number
  readonly taskEvents: number
  readonly people: number
  readonly notes: number
}

/** Quantos registros existem agora, para a pre-visualizacao "isto vai ser substituido". */
export async function currentCounts(db: MatrizDB): Promise<ImportCounts> {
  const [tasks, taskEvents, people, notes] = await Promise.all([
    db.tasks.count(),
    db.task_events.count(),
    db.people.count(),
    db.notes.count(),
  ])
  return { tasks, taskEvents, people, notes }
}

/**
 * Substitui TODO o conteudo das tres tabelas pelo do backup, numa unica
 * transacao - ou importa tudo, ou (se algo falhar) nao muda nada.
 *
 * Marca toda tarefa importada como pendente: um backup pode vir de outro
 * aparelho, de um momento diferente, ou estar restaurando depois de perder
 * dados — nos tres casos o servidor pode nao ter esse estado ainda, entao o
 * proximo sync tem que empurrar tudo (a mesclagem reconcilia certo com o
 * que estiver no Drive, usando o `updated_at` que ja vem em cada tarefa).
 */
export function applyBackup(db: MatrizDB, backup: Backup): Promise<void> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.people, db.notes, db.meta, async () => {
    await Promise.all([db.tasks.clear(), db.task_events.clear(), db.people.clear(), db.notes.clear()])
    await Promise.all([
      db.tasks.bulkAdd(backup.tasks),
      db.task_events.bulkAdd(backup.task_events),
      db.people.bulkAdd(backup.people),
      db.notes.bulkAdd(backup.notes),
    ])

    const meta = await getMeta(db)
    await db.meta.put(
      {
        ...meta,
        pending_ids: [...backup.tasks.map((task) => task.id), ...backup.notes.map((note) => note.id)],
      },
      LOCAL_META_KEY,
    )
  })
}
