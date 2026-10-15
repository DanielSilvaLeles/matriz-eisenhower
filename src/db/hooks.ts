/**
 * Leitura reativa do banco local para a interface. `useLiveQuery` reexecuta
 * a consulta sozinho sempre que uma escrita Dexie muda algo que ela leu -
 * e o que faz "resposta instantanea" (docs secao 4.8) funcionar sem
 * gerenciar estado React a mao: toda mutacao do repositorio e so escrever
 * no Dexie, e a tela se atualiza.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task, TaskEvent } from '@/domain/schema.ts'
import { sortTasksForQuadrant } from '@/domain/taskLifecycle.ts'
import { computeWeeklyReview, type WeeklyReviewStats } from '@/domain/weeklyReview.ts'
import { listPeopleNames } from './peopleRepo.ts'
import { getDB, LOCAL_META_KEY } from './schema.ts'

const EMPTY_TASKS: readonly Task[] = []

/**
 * Tarefas abertas de um quadrante, na ordem de exibicao (docs secao 5.4):
 * posicao manual em Q1/Q3/Q4, por data em Q2 - ver sortTasksForQuadrant.
 */
export function useOpenTasks(quadrant: QuadrantId): readonly Task[] {
  const db = getDB()
  const tasks = useLiveQuery(
    () => db.tasks.where('[quadrant+status]').equals([quadrant, 'open']).toArray(),
    [quadrant],
    EMPTY_TASKS,
  )
  // useLiveQuery pode devolver uma referencia nova com o mesmo conteudo a
  // cada notificacao do Dexie; memoiza so a ordenacao, nao a consulta.
  return useMemo(() => sortTasksForQuadrant(tasks, quadrant), [tasks, quadrant])
}

/**
 * Quantas tarefas abertas do quadrante tem a data de hoje (docs secao 5.1,
 * faixa "Hoje": "quantas agendadas para hoje" em Q2, "quantas cobranças...
 * vencem hoje" em Q3). So o dia exato - atrasadas de Q2 nao entram aqui,
 * tem selo proprio ("Atrasada") em vez de contar como "hoje".
 */
export function useScheduledTodayCount(quadrant: QuadrantId, today: string): number {
  const tasks = useOpenTasks(quadrant)
  return useMemo(() => tasks.filter((task) => task.date === today).length, [tasks, today])
}

/** Quantidade de tarefas abertas - o contador n/10 do cabecalho. */
export function useOpenTaskCount(quadrant: QuadrantId): number {
  const db = getDB()
  return useLiveQuery(
    () => db.tasks.where('[quadrant+status]').equals([quadrant, 'open']).count(),
    [quadrant],
    0,
  )
}

/** Inicio do dia local, em ISO UTC - para comparar com `completed_at`. */
function startOfTodayISO(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

/**
 * Tarefas concluidas hoje neste quadrante, para o rodape "Concluidas hoje (n)"
 * (docs secao 5.1). Comparar strings ISO em UTC funciona porque o formato
 * `AAAA-MM-DDTHH:mm:ss.sssZ` ordena igual cronologicamente e lexicografico.
 */
export function useCompletedToday(quadrant: QuadrantId): readonly Task[] {
  const db = getDB()
  const todayStart = startOfTodayISO()

  const tasks = useLiveQuery(
    () => db.tasks.where('[quadrant+status]').equals([quadrant, 'done']).toArray(),
    [quadrant],
    EMPTY_TASKS,
  )

  return useMemo(
    () =>
      tasks
        .filter((task) => task.completed_at !== null && task.completed_at >= todayStart)
        .toSorted((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks, todayStart],
  )
}

/**
 * Itens da caixa de entrada, do mais antigo para o mais novo - e a ordem que
 * faz sentido para "ha quanto tempo esta parado" (docs secao 5.2): o que
 * espera ha mais tempo aparece primeiro.
 *
 * `null` nao e chave valida de indice composto (ver a mesma nota em
 * src/db/tasksRepo.ts), entao a consulta usa o indice `status` sozinho e
 * filtra `quadrant === null` em JS - tudo bem, a caixa de entrada e pequena
 * por natureza (a meta e zera-la todo dia, docs secao 2).
 */
export function useInboxTasks(): readonly Task[] {
  const db = getDB()
  const tasks = useLiveQuery(
    () => db.tasks.where('status').equals('open').toArray(),
    [],
    EMPTY_TASKS,
  )

  return useMemo(
    () =>
      tasks
        .filter((task) => task.quadrant === null)
        .toSorted((a, b) => a.created_at.localeCompare(b.created_at)),
    [tasks],
  )
}

/** Quantidade de itens na caixa de entrada - o badge do painel. */
export function useInboxCount(): number {
  return useInboxTasks().length
}

/** Uma unica tarefa, ao vivo - usado pelo painel de detalhe (docs secao 5.5). */
export function useTask(taskId: string | null): Task | undefined {
  const db = getDB()
  return useLiveQuery(() => (taskId === null ? undefined : db.tasks.get(taskId)), [taskId])
}

/** Contador de alteracoes pendentes de confirmacao (docs secao 6.3). */
export function usePendingCount(): number {
  const db = getDB()
  return useLiveQuery(
    async () => (await db.meta.get(LOCAL_META_KEY))?.pending_ids.length ?? 0,
    [],
    0,
  )
}

const EMPTY_EVENTS: readonly TaskEvent[] = []

/** Linha do tempo de uma tarefa (docs secao 5.5), do mais antigo para o mais novo. */
export function useTaskEvents(taskId: string | null): readonly TaskEvent[] {
  const db = getDB()
  const events = useLiveQuery(
    () => (taskId === null ? [] : db.task_events.where('task_id').equals(taskId).toArray()),
    [taskId],
    EMPTY_EVENTS,
  )
  return useMemo(() => events.toSorted((a, b) => a.at.localeCompare(b.at)), [events])
}

const HISTORY_STATUSES = ['done', 'archived'] as const

/**
 * Historico pesquisavel (docs secao 5.9): concluidas e eliminadas, mais
 * recente primeiro. A busca em si (por titulo) fica na UI - aqui so le o
 * universo inteiro, que para um usuario so tende a ser pequeno.
 */
export function useHistoryTasks(): readonly Task[] {
  const db = getDB()
  const tasks = useLiveQuery(
    () => db.tasks.where('status').anyOf(HISTORY_STATUSES).toArray(),
    [],
    EMPTY_TASKS,
  )
  return useMemo(
    () => tasks.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [tasks],
  )
}

const EMPTY_NAMES: readonly string[] = []

/** Nomes conhecidos para o autocomplete de "Para quem?" (docs secao 5.3). */
export function usePeopleNames(): readonly string[] {
  const db = getDB()
  return useLiveQuery(() => listPeopleNames(db), [], EMPTY_NAMES)
}

/** Inicio da semana local (segunda-feira), em ISO UTC - para "n eliminadas esta semana" e a revisao semanal. */
function startOfWeekISO(): string {
  const now = new Date()
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoWeekday - 1))
  return monday.toISOString()
}

/**
 * Quantas tarefas foram arquivadas (eliminadas) esta semana - reforco
 * positivo no rodape do quadrante Eliminar (docs secao 5.4). Conta por
 * evento, nao por `tasks.status`, porque o status so diz "arquivada agora",
 * nao "quando" - e `task_events` existe exatamente para isso (docs secao 10).
 */
export function useEliminatedThisWeek(): number {
  const db = getDB()
  const weekStart = startOfWeekISO()
  return useLiveQuery(
    async () =>
      (await db.task_events.where('at').aboveOrEqual(weekStart).toArray()).filter(
        (event) => event.type === 'archived',
      ).length,
    [weekStart],
    0,
  )
}

const EMPTY_WEEKLY_REVIEW: WeeklyReviewStats = {
  completedByQuadrant: { q1: 0, q2: 0, q3: 0, q4: 0 },
  cameFromOverdueQ2ToQ1: 0,
  averageInboxMinutes: null,
  eliminatedCount: 0,
}

/**
 * Revisão semanal (docs secao 5.9): lê tarefas e eventos inteiros - aceitável
 * na escala de um usuário só - e deixa o cálculo de verdade para
 * `computeWeeklyReview` (puro, testado à parte).
 */
export function useWeeklyReview(): WeeklyReviewStats {
  const db = getDB()
  const weekStart = startOfWeekISO()
  return useLiveQuery(
    async () => {
      const [tasks, events] = await Promise.all([db.tasks.toArray(), db.task_events.toArray()])
      return computeWeeklyReview(tasks, events, weekStart)
    },
    [weekStart],
    EMPTY_WEEKLY_REVIEW,
  )
}
