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
import type { Task } from '@/domain/schema.ts'
import { getDB } from './schema.ts'

function byPosition(a: Task, b: Task): number {
  return a.position - b.position
}

const EMPTY_TASKS: readonly Task[] = []

/** Tarefas abertas de um quadrante, ordenadas pela posicao de exibicao. */
export function useOpenTasks(quadrant: QuadrantId): readonly Task[] {
  const db = getDB()
  const tasks = useLiveQuery(
    () => db.tasks.where('[quadrant+status]').equals([quadrant, 'open']).toArray(),
    [quadrant],
    EMPTY_TASKS,
  )
  // useLiveQuery pode devolver uma referencia nova com o mesmo conteudo a
  // cada notificacao do Dexie; memoiza so a ordenacao, nao a consulta.
  return useMemo(() => tasks.toSorted(byPosition), [tasks])
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
