/**
 * editTaskFields, archiveTaskById, restoreTaskFromHistory - separado de
 * tasksRepo.ts so pelo limite de linhas do lint (mesma camada, mesmas
 * convencoes: cada funcao e uma transacao que grava e marca pendencia).
 */
import { positionBetween } from '@/domain/position.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import {
  archiveTask,
  editTaskFields as editTaskFieldsPure,
  restoreTask,
  type TaskFieldEdits,
} from '@/domain/taskLifecycle.ts'
import { notifyLocalWrite } from './changeSignal.ts'
import { getDeviceName } from './device.ts'
import { markPendingInTx } from './metaRepo.ts'
import { ensurePersonInTx } from './peopleRepo.ts'
import type { MatrizDB } from './schema.ts'
import { getTaskOrThrow, lastPosition, newId, nowISO } from './tasksRepo.ts'

/**
 * Edita os campos do painel de detalhe (docs secao 5.5): titulo, notas,
 * data, delegacao, tags. Garante a pessoa em `people` na mesma transacao
 * quando `delegated_to` vem preenchido - e o unico lugar que cria uma
 * pessoa nova (docs secao 10: "criada automaticamente na primeira
 * delegacao"). Sem evento: edicao de campo nao entra na linha do tempo
 * (ver o comentario em src/domain/task.ts).
 */
export function editTaskFields(
  db: MatrizDB,
  taskId: string,
  edits: TaskFieldEdits,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.people, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const now = nowISO()
    const task = editTaskFieldsPure(existing, edits, device, now)
    await db.tasks.put(task)
    if (edits.delegated_to !== undefined && edits.delegated_to !== null) {
      await ensurePersonInTx(db, edits.delegated_to, now)
    }
    await markPendingInTx(db, task.id)
    return task
  })
}

/** Arquiva uma unica tarefa de Q4 - chamado pelo arquivamento automatico, src/db/archiveQ4.ts. */
export function archiveTaskById(
  db: MatrizDB,
  taskId: string,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = archiveTask(existing, { eventId: newId(), device }, nowISO())
    await db.tasks.put(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
    return task
  })
}

/** Restaura do historico (concluidas/eliminadas) de volta para aberta num quadrante (docs secao 5.9). */
export function restoreTaskFromHistory(
  db: MatrizDB,
  taskId: string,
  toQuadrant: QuadrantId | null,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const position = positionBetween(await lastPosition(db, toQuadrant), null)
    const { task, event } = restoreTask(
      existing,
      toQuadrant,
      position,
      { eventId: newId(), device },
      nowISO(),
    )
    await db.tasks.put(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
    return task
  })
}
