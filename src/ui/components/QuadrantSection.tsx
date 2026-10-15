import { useOpenTaskCount, useOpenTasks, useCompletedToday } from '@/db/hooks.ts'
import { getDB } from '@/db/schema.ts'
import { addTaskToQuadrant, completeTaskById, reopenTaskById } from '@/db/tasksRepo.ts'
import type { QuadrantMeta } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'
import { AddTaskField } from './AddTaskField.tsx'
import { CompletedTodayList } from './CompletedTodayList.tsx'
import { QuadrantCard } from './QuadrantCard.tsx'
import { TaskRow } from './TaskRow.tsx'

export interface QuadrantSectionProps {
  quadrant: QuadrantMeta
}

/**
 * Liga o quadrante ao banco: le as tarefas abertas e as concluidas hoje,
 * escreve as mutacoes. QuadrantCard e os componentes de tarefa continuam
 * sem saber que o Dexie existe - so recebem dados e callbacks.
 */
export function QuadrantSection({ quadrant }: QuadrantSectionProps) {
  const db = getDB()
  const openTasks = useOpenTasks(quadrant.id)
  const openCount = useOpenTaskCount(quadrant.id)
  const completedToday = useCompletedToday(quadrant.id)
  const accentClass = QUADRANT_STYLES[quadrant.id].accent

  function handleToggle(task: Task) {
    const write =
      task.status === 'open'
        ? completeTaskById(db, task.id)
        : reopenTaskById(db, task.id)

    write.catch((error: unknown) => {
      // Sem toast/undo ainda (fase 1c): por ora, so registra para depurar.
      // A tarefa continua visivel no estado anterior, nada se perde.
      console.error('Falha ao atualizar a tarefa', error)
    })
  }

  return (
    <QuadrantCard quadrant={quadrant} openCount={openCount}>
      <AddTaskField
        quadrantVerb={quadrant.verb}
        onAdd={(title) => addTaskToQuadrant(db, quadrant.id, title)}
      />

      {openTasks.length === 0 && completedToday.length === 0 ? (
        <p className="text-xs text-text-subtle">
          Vazio. Ex.: &ldquo;{quadrant.emptyExample}&rdquo;
        </p>
      ) : (
        <ul>
          {openTasks.map((task) => (
            <TaskRow key={task.id} task={task} accentClass={accentClass} onToggle={handleToggle} />
          ))}
        </ul>
      )}

      <CompletedTodayList
        tasks={completedToday}
        accentClass={accentClass}
        onToggle={handleToggle}
      />
    </QuadrantCard>
  )
}
