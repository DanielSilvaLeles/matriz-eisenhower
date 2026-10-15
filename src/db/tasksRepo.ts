/**
 * Repositorio de tarefas: a unica camada que mistura o dominio puro
 * (src/domain) com efeito colateral (Dexie, relogio, geracao de id).
 *
 * Cada funcao publica e uma transacao: le o que precisa, chama a mutacao
 * pura correspondente em src/domain/task.ts, e grava a tarefa e o evento
 * juntos. Se qualquer parte falhar, a transacao inteira desfaz - nunca fica
 * uma tarefa gravada sem o evento que a explica.
 *
 * Toda escrita tambem marca o id como pendente de confirmacao
 * (`markPendingInTx`, dentro da mesma transacao - docs secao 6.3: "contador
 * de alteracoes pendentes sempre visivel"). So o motor de sync
 * (src/sync/) limpa essa marca, e so depois de reler e confirmar o
 * checksum (docs secao 6.1, passos 4 e 5).
 */
import { positionBetween } from '@/domain/position.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task, TaskSource } from '@/domain/schema.ts'
import {
  completeTask,
  createTask,
  moveTask,
  reopenTask,
  reorderTask,
} from '@/domain/task.ts'
import { notifyLocalWrite } from './changeSignal.ts'
import { getDeviceName } from './device.ts'
import { markPendingInTx, unmarkPendingInTx } from './metaRepo.ts'
import type { MatrizDB } from './schema.ts'

function newId(): string {
  return crypto.randomUUID()
}

function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Maior `position` entre as tarefas abertas de um quadrante - ou da caixa de
 * entrada, se `quadrant` for `null`.
 *
 * `null` nao e uma chave valida de IndexedDB: `.where('[quadrant+status]')
 * .equals([null, 'open'])` lanca `DataError` em vez de devolver vazio (e por
 * isso um item da caixa de entrada nunca aparece no indice composto). Para
 * `null`, a consulta cai para o indice `status` sozinho e filtra em JS -
 * aceitavel porque a caixa de entrada, por natureza, fica pequena.
 */
async function lastPosition(db: MatrizDB, quadrant: QuadrantId | null): Promise<number | null> {
  const open =
    quadrant === null
      ? (await db.tasks.where('status').equals('open').toArray()).filter(
          (task) => task.quadrant === null,
        )
      : await db.tasks.where('[quadrant+status]').equals([quadrant, 'open']).toArray()

  return open.reduce<number | null>(
    (max, task) => (max === null || task.position > max ? task.position : max),
    null,
  )
}

/**
 * Apaga de vez uma tarefa e seus eventos - usado so para desfazer uma
 * colagem multilinha na caixa de entrada (docs secao 5.2): os itens acabaram
 * de nascer, nunca foram triados nem sincronizados, entao remover de
 * verdade (nao so marcar `deleted`) e seguro. Nao e uma funcao geral de
 * excluir tarefa - essa e exclusao logica com restaurar pelo historico
 * (fase 3), bem diferente desta.
 */
export function discardTask(db: MatrizDB, taskId: string): Promise<void> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    await db.task_events.where('task_id').equals(taskId).delete()
    await db.tasks.delete(taskId)
    await unmarkPendingInTx(db, taskId)
  })
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Tarefa nao encontrada: ${taskId}`)
  }
}

/**
 * Adiciona uma tarefa direto num quadrante, no fim da lista. E o que o campo
 * "Adicionar tarefa" de cada quadrante usa (docs secao 5.1).
 */
export function addTaskToQuadrant(
  db: MatrizDB,
  quadrant: QuadrantId,
  title: string,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const position = positionBetween(await lastPosition(db, quadrant), null)
    const now = nowISO()

    const { task, event } = createTask(
      { id: newId(), eventId: newId(), title, quadrant, position, device },
      now,
    )

    await db.tasks.add(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
    return task
  })
}

/**
 * Adiciona um item na caixa de entrada - a porta de entrada da captura
 * (docs secao 5.2 e 8). `title` e `tags` ja chegam interpretados por
 * `captureItem` (src/capture.ts); esta funcao so grava.
 */
export function addTaskToInbox(
  db: MatrizDB,
  title: string,
  tags: readonly string[],
  source: TaskSource,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const position = positionBetween(await lastPosition(db, null), null)
    const now = nowISO()

    const { task, event } = createTask(
      {
        id: newId(),
        eventId: newId(),
        title,
        quadrant: null,
        position,
        device,
        source,
        tags,
      },
      now,
    )

    await db.tasks.add(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
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
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = completeTask(existing, { eventId: newId(), device }, nowISO())
    await db.tasks.put(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
    return task
  })
}

/** Desfaz a conclusao: a tarefa volta a lista aberta do mesmo quadrante. */
export function reopenTaskById(
  db: MatrizDB,
  taskId: string,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = reopenTask(existing, { eventId: newId(), device }, nowISO())
    await db.tasks.put(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)
    return task
  })
}

/**
 * Move para outro quadrante, ou de volta para a caixa de entrada
 * (`toQuadrant: null` - tecla `0` e opcao "Caixa de entrada" do menu
 * "Mover para"). Sempre no fim da lista de destino.
 */
export function moveTaskToQuadrant(
  db: MatrizDB,
  taskId: string,
  toQuadrant: QuadrantId | null,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const position = positionBetween(await lastPosition(db, toQuadrant), null)
    const { task, event } = moveTask(
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

/**
 * Restaura quadrante e posicao exatos de uma tarefa - so para o desfazer de
 * uma movimentacao (src/ui/actions/moveTaskWithUndo.ts). Diferente de
 * moveTaskToQuadrant, que sempre poe no fim da lista de destino: aqui a
 * posicao e a exata de antes da movimentacao, para "Desfazer" devolver a
 * tarefa ao lugar de onde ela saiu, nao ao fim da lista de origem.
 */
export function restoreTaskPlacement(
  db: MatrizDB,
  taskId: string,
  quadrant: QuadrantId | null,
  position: number,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.task_events, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const { task, event } = moveTask(
      existing,
      quadrant,
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

/**
 * Reordena dentro do mesmo quadrante (arrastar para cima/baixo na mesma
 * lista). Sem evento - ver reorderTask no dominio.
 */
export function reorderTaskPosition(
  db: MatrizDB,
  taskId: string,
  position: number,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.tasks, db.meta, async () => {
    const existing = await getTaskOrThrow(db, taskId)
    const task = reorderTask(existing, position, device, nowISO())
    await db.tasks.put(task)
    await markPendingInTx(db, task.id)
    return task
  })
}
