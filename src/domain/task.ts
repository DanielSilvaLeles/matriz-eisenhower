/**
 * Mutacoes de tarefa: criar, mover entre quadrantes, concluir, reabrir.
 *
 * Toda funcao e pura e deterministica: recebe `now` (o instante) e os ids
 * novos (`id`/`eventId`) como parametros, em vez de chamar `Date.now()` ou
 * `crypto.randomUUID()' por conta propria. Quem gera esses valores e a
 * camada impura (o repositorio em src/db), que tambem grava no Dexie. Essa
 * divisao e o que torna estas funcoes faceis de testar com entradas fixas.
 *
 * `device` em cada mutacao e o aparelho que fez a acao agora - nao o que
 * criou a tarefa. E o campo `tasks.device` que a mesclagem usa para
 * desempatar quando dois aparelhos editam a mesma tarefa com o mesmo
 * `updated_at` (docs secao 6.2): ele precisa refletir sempre a ultima
 * escrita, por isso toda mutacao o atualiza.
 */
import type { QuadrantId } from './quadrant.ts'
import type { Task, TaskContext, TaskEvent, TaskSource } from './schema.ts'

export interface TaskMutationResult {
  readonly task: Task
  readonly event: TaskEvent
}

export interface NewTaskInput {
  readonly id: string
  readonly eventId: string
  readonly title: string
  /** `null` so faz sentido quando a caixa de entrada existir (fase 1c). */
  readonly quadrant: QuadrantId | null
  readonly position: number
  readonly device: string
  readonly source?: TaskSource
  readonly context?: TaskContext
}

/** Cria uma tarefa nova e o evento `created` correspondente. */
export function createTask(input: NewTaskInput, now: string): TaskMutationResult {
  const title = input.title.trim()
  if (title === '') {
    throw new Error('Titulo da tarefa nao pode ser vazio.')
  }

  const task: Task = {
    id: input.id,
    title,
    notes: null,
    quadrant: input.quadrant,
    status: 'open',
    position: input.position,
    date: null,
    delegated_to: null,
    delegation_context: null,
    expected_outcome: null,
    tags: [],
    source: input.source ?? 'web',
    context: input.context ?? 'work',
    created_at: now,
    updated_at: now,
    completed_at: null,
    deleted: false,
    device: input.device,
  }

  const event: TaskEvent = {
    id: input.eventId,
    task_id: task.id,
    type: 'created',
    from_quadrant: null,
    to_quadrant: task.quadrant,
    at: now,
    device: input.device,
  }

  return { task, event }
}

export interface MutationParams {
  readonly eventId: string
  readonly device: string
}

/**
 * Move a tarefa para outro quadrante. Para reordenar dentro do mesmo
 * quadrante (so a `position` muda), isso nao e uma movimentacao - a funcao
 * recusa a chamada para deixar o engano visivel em vez de gerar um evento
 * "moved" sem significado no historico.
 */
export function moveTask(
  task: Task,
  toQuadrant: QuadrantId,
  position: number,
  params: MutationParams,
  now: string,
): TaskMutationResult {
  if (toQuadrant === task.quadrant) {
    throw new Error(
      'moveTask e para trocar de quadrante. Para reordenar dentro do mesmo ' +
        'quadrante, atualize a position diretamente - nao gera evento.',
    )
  }

  const updated: Task = {
    ...task,
    quadrant: toQuadrant,
    position,
    updated_at: now,
    device: params.device,
  }

  const event: TaskEvent = {
    id: params.eventId,
    task_id: task.id,
    type: 'moved',
    from_quadrant: task.quadrant,
    to_quadrant: toQuadrant,
    at: now,
    device: params.device,
  }

  return { task: updated, event }
}

/** Marca como concluida: risca na lista e recolhe em "Concluidas hoje". */
export function completeTask(
  task: Task,
  params: MutationParams,
  now: string,
): TaskMutationResult {
  if (task.status !== 'open') {
    throw new Error(`So uma tarefa aberta pode ser concluida (estava "${task.status}").`)
  }

  const updated: Task = {
    ...task,
    status: 'done',
    completed_at: now,
    updated_at: now,
    device: params.device,
  }

  const event: TaskEvent = {
    id: params.eventId,
    task_id: task.id,
    type: 'completed',
    from_quadrant: task.quadrant,
    to_quadrant: task.quadrant,
    at: now,
    device: params.device,
  }

  return { task: updated, event }
}

/** Desfaz a conclusao: a tarefa volta a aberta no mesmo quadrante. */
export function reopenTask(
  task: Task,
  params: MutationParams,
  now: string,
): TaskMutationResult {
  if (task.status !== 'done') {
    throw new Error(`So uma tarefa concluida pode ser reaberta (estava "${task.status}").`)
  }

  const updated: Task = {
    ...task,
    status: 'open',
    completed_at: null,
    updated_at: now,
    device: params.device,
  }

  const event: TaskEvent = {
    id: params.eventId,
    task_id: task.id,
    type: 'reopened',
    from_quadrant: task.quadrant,
    to_quadrant: task.quadrant,
    at: now,
    device: params.device,
  }

  return { task: updated, event }
}
