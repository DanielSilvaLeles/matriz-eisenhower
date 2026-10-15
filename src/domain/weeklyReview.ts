/**
 * Revisão semanal (docs secao 5.9, fase 5): distribuição das concluídas por
 * quadrante, quantas tarefas de Q1 vieram de Q2 atrasado, tempo médio parado
 * na caixa de entrada, quantas foram eliminadas - tudo na janela desta
 * semana (segunda-feira até agora). Puro: recebe `tasks`/`events` já lidos
 * do banco e o início da semana como parâmetro, nunca lê o relógio.
 */
import { localDateOf } from './time.ts'
import type { QuadrantId } from './quadrant.ts'
import type { Task, TaskEvent } from './schema.ts'

export interface WeeklyReviewStats {
  readonly completedByQuadrant: Record<QuadrantId, number>
  /**
   * Quantas tarefas chegaram em Q1 vindas de Q2 já com o prazo vencido
   * (docs secao 3, princípio 1: "quando tarefas caem em Q1 repetidamente, é
   * sinal de falha de planejamento"). Aproximação: compara a data **atual**
   * da tarefa (não há um retrato histórico de `date` no evento) com o dia
   * da movimentação - se a tarefa teve a data alterada depois de chegar em
   * Q1, esta contagem pode não refletir mais mais a realidade de quando ela
   * se moveu. Documentado aqui de propósito.
   */
  readonly cameFromOverdueQ2ToQ1: number
  /** `null` quando nenhum item saiu da caixa de entrada nesta semana. */
  readonly averageInboxMinutes: number | null
  readonly eliminatedCount: number
}

const EMPTY_BY_QUADRANT: Record<QuadrantId, number> = { q1: 0, q2: 0, q3: 0, q4: 0 }

function isThisWeek(at: string, weekStartIso: string): boolean {
  return at >= weekStartIso
}

export function computeWeeklyReview(
  tasks: readonly Task[],
  events: readonly TaskEvent[],
  weekStartIso: string,
): WeeklyReviewStats {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

  const completedByQuadrant: Record<QuadrantId, number> = { ...EMPTY_BY_QUADRANT }
  for (const task of tasks) {
    if (
      task.status === 'done' &&
      task.completed_at !== null &&
      task.quadrant !== null &&
      isThisWeek(task.completed_at, weekStartIso)
    ) {
      completedByQuadrant[task.quadrant] += 1
    }
  }

  let cameFromOverdueQ2ToQ1 = 0
  const inboxMinutes: number[] = []
  let eliminatedCount = 0

  for (const event of events) {
    if (!isThisWeek(event.at, weekStartIso)) continue

    if (event.type === 'moved' && event.from_quadrant === 'q2' && event.to_quadrant === 'q1') {
      const task = tasksById.get(event.task_id)
      if (task?.date !== undefined && task.date !== null && task.date < localDateOf(event.at)) {
        cameFromOverdueQ2ToQ1 += 1
      }
    }

    if (event.type === 'moved' && event.from_quadrant === null) {
      const task = tasksById.get(event.task_id)
      if (task) {
        const minutes = (Date.parse(event.at) - Date.parse(task.created_at)) / 60_000
        if (minutes >= 0) inboxMinutes.push(minutes)
      }
    }

    if (event.type === 'archived') {
      eliminatedCount += 1
    }
  }

  const averageInboxMinutes =
    inboxMinutes.length === 0
      ? null
      : inboxMinutes.reduce((sum, minutes) => sum + minutes, 0) / inboxMinutes.length

  return { completedByQuadrant, cameFromOverdueQ2ToQ1, averageInboxMinutes, eliminatedCount }
}

/** "2h 15min" ou "45min" - para o painel de revisão semanal. */
export function formatInboxDuration(minutes: number): string {
  const totalMinutes = Math.round(minutes)
  const hours = Math.floor(totalMinutes / 60)
  const rest = totalMinutes % 60
  if (hours === 0) return `${rest}min`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}min`
}
