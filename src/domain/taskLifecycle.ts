/**
 * Mutacoes de tarefa alem do ciclo basico (src/domain/task.ts): arquivar,
 * restaurar do historico, editar campos do painel de detalhe, e a ordem de
 * exibicao por quadrante. Separado so para manter cada arquivo dentro do
 * limite de linhas do lint - a divisao nao reflete nenhuma fronteira de
 * dominio real, por isso ambos exportam para o mesmo tipo de consumidor
 * (src/db/tasksRepo.ts).
 */
import type { QuadrantId } from './quadrant.ts'
import type { MutationParams, TaskMutationResult } from './task.ts'
import type { Task, TaskEvent } from './schema.ts'

/**
 * Ordem de exibicao por quadrante (docs secao 5.4): Q2 "ordenada por data"
 * (sem data fica no fim, depois disso o aviso "sem data" ja cuida de
 * chamar atencao) - os demais seguem a posicao manual (arrastar/reordenar,
 * teclado, menu "Mover para"). Dentro da mesma data, ou quando nenhuma das
 * duas tem data, desempata pela posicao, para a ordem ficar estavel.
 */
export function sortTasksForQuadrant(tasks: readonly Task[], quadrant: QuadrantId): Task[] {
  if (quadrant !== 'q2') return tasks.toSorted((a, b) => a.position - b.position)

  return tasks.toSorted((a, b) => {
    if (a.date === null && b.date === null) return a.position - b.position
    if (a.date === null) return 1
    if (b.date === null) return -1
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.position - b.position
  })
}

/**
 * Arquiva uma tarefa de Q4 na virada do dia (docs secao 5.4): "soltar aqui é
 * decidir não fazer... é arquivado automaticamente". Quem decide QUANDO
 * chamar isto é `src/db/archiveQ4.ts` (compara `updated_at` com a data de
 * hoje); esta função só sabe fazer a transição em si.
 */
export function archiveTask(task: Task, params: MutationParams, now: string): TaskMutationResult {
  if (task.status !== 'open') {
    throw new Error(`So uma tarefa aberta pode ser arquivada (estava "${task.status}").`)
  }
  if (task.quadrant !== 'q4') {
    throw new Error('So tarefas de Eliminar (q4) sao arquivadas automaticamente.')
  }

  const updated: Task = { ...task, status: 'archived', updated_at: now, device: params.device }
  const event: TaskEvent = {
    id: params.eventId,
    task_id: task.id,
    type: 'archived',
    from_quadrant: task.quadrant,
    to_quadrant: task.quadrant,
    at: now,
    device: params.device,
  }

  return { task: updated, event }
}

/**
 * Traz de volta uma tarefa concluída ou arquivada, pelo histórico (docs
 * secao 5.9). Usa o tipo de evento "reopened" - semanticamente é a mesma
 * coisa que reopenTask (voltar a estar aberta), só que a partir de um status
 * diferente e com quadrante de destino escolhido na hora, não o original.
 */
export function restoreTask(
  task: Task,
  toQuadrant: QuadrantId | null,
  position: number,
  params: MutationParams,
  now: string,
): TaskMutationResult {
  if (task.status === 'open') {
    throw new Error('So uma tarefa concluida ou arquivada pode ser restaurada.')
  }

  const updated: Task = {
    ...task,
    status: 'open',
    quadrant: toQuadrant,
    position,
    completed_at: null,
    updated_at: now,
    device: params.device,
  }
  const event: TaskEvent = {
    id: params.eventId,
    task_id: task.id,
    type: 'reopened',
    from_quadrant: task.quadrant,
    to_quadrant: toQuadrant,
    at: now,
    device: params.device,
  }

  return { task: updated, event }
}

export interface TaskFieldEdits {
  readonly title?: string
  readonly notes?: string | null
  readonly date?: string | null
  readonly delegated_to?: string | null
  readonly delegation_context?: string | null
  readonly expected_outcome?: string | null
  readonly tags?: readonly string[]
}

/**
 * Edição de campos do painel de detalhe (docs secao 5.5): "salva sozinho ao
 * editar", sem gerar evento de histórico - movimentar, concluir, reabrir e
 * arquivar são os únicos tipos em `TASK_EVENT_TYPES` (docs secao 10); editar
 * notas/data/delegação não entra na linha do tempo, só atualiza a tarefa.
 */
export function editTaskFields(
  task: Task,
  edits: TaskFieldEdits,
  device: string,
  now: string,
): Task {
  const title = edits.title === undefined ? task.title : edits.title.trim()
  if (title === '') {
    throw new Error('Titulo da tarefa nao pode ser vazio.')
  }

  return {
    ...task,
    ...edits,
    title,
    tags: edits.tags ? [...edits.tags] : task.tags,
    updated_at: now,
    device,
  }
}
