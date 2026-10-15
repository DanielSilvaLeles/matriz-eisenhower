/**
 * Repositorio de tarefas: a unica camada que mistura o dominio puro
 * (src/domain) com efeito colateral (Dexie, relogio, geracao de id).
 *
 * Cada funcao publica e uma transacao: le o que precisa, chama a mutacao
 * pura correspondente em src/domain/task.ts, e grava a tarefa e o evento
 * juntos. Se qualquer parte falhar, a transacao inteira desfaz - nunca fica
 * uma tarefa gravada sem o evento que a explica.
 */
import { positionBetween } from '@/domain/position.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { completeTask, createTask, moveTask, reopenTask } from '@/domain/task.ts'
import { getDeviceName } from './device.ts'
import type { MatrizDB } from './schema.ts'

function newId(): string {
  return crypto.randomUUID()
}

function nowISO(): string {
  return new Date().toISOString()
}

/** Maior `position` entre as tarefas abertas de um quadrante, ou `null` se vazio. */
async function lastOpenPosition(
  db: MatrizDB,
  quadrant: QuadrantId,
): Promise<number | null> {
  const open = await db.tasks
    .where('[quadrant+status]')
    .equals([quadrant, 'open'])
    .toArray()

  return open.reduce<number | null>(
    (max, task) => (max === null || task.position > max ? task.position : max),
    null,
  )
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Tarefa nao encontrada: ${taskId}`)
  }
}

/**
 * Adiciona uma tarefa direto num quadrante, no fim da lista. E o que o campo
 * "Adicionar tarefa" de cada quadrante usa (docs secao 5.1) - antes de a
 * caixa de entrada existir (fase 1c), toda captura ja nasce classificada.
 */
export function addTaskToQuadrant(
  db: MatrizDB,
  quadrant: QuadrantId,
  title: string,
  device: string = getDeviceName(),
): Promise<Task> {
  return db.transaction('rw', db.tasks, db.task_events, async () => {
    const position = positionBetween(await lastOpenPosition(db, quadrant), null)
    const now = nowISO()

    const { task, event } = createTask(
      { id: newId(), eventId: newId(), title, quadrant, position, device },
      now,
    )

    await db.tasks.add(task)
    await db.task_events.add(event)
    return task
  })
}

async function getTaskOrThrow(db: MatrizDB, taskId: string): Promise<Task> {
  const task = await db.tasks.get(taskId)
  if (!task) throw new TaskNotFoundError(taskId)
  return task
}

/** Risca a tarefa: recolhe para "Concluidas hoje" no rodape do quadrante. */
export function completeTaskById(
  db: MatrizDB,
  taskId: string,
  device: string = getDeviceName(),
): Promise<Task> {
  return db.transaction('rw', db.tasks, db.task_events, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = completeTask(existing, { eventId: newId(), device }, nowISO())
    await db.tasks.put(task)
    await db.task_events.add(event)
    return task
  })
}

/** Desfaz a conclusao: a tarefa volta a lista aberta do mesmo quadrante. */
export function reopenTaskById(
  db: MatrizDB,
  taskId: string,
  device: string = getDeviceName(),
): Promise<Task> {
  return db.transaction('rw', db.tasks, db.task_events, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = reopenTask(existing, { eventId: newId(), device }, nowISO())
    await db.tasks.put(task)
    await db.task_events.add(event)
    return task
  })
}

/**
 * Move para outro quadrante, no fim da lista de destino. Ainda sem lugar na
 * interface nesta fase (arrastar e atalhos de teclado sao da fase 1c) - mas
 * ja fica pronta porque e so a camada de efeito colateral sobre moveTask,
 * ja testada no dominio.
 */
export function moveTaskToQuadrant(
  db: MatrizDB,
  taskId: string,
  toQuadrant: QuadrantId,
  device: string = getDeviceName(),
): Promise<Task> {
  return db.transaction('rw', db.tasks, db.task_events, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const position = positionBetween(await lastOpenPosition(db, toQuadrant), null)
    const { task, event } = moveTask(
      existing,
      toQuadrant,
      position,
      { eventId: newId(), device },
      nowISO(),
    )
    await db.tasks.put(task)
    await db.task_events.add(event)
    return task
  })
}
