import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useOpenTaskCount, useOpenTasks, useCompletedToday } from '@/db/hooks.ts'
import { getDB } from '@/db/schema.ts'
import { addTaskToQuadrant, completeTaskById, reopenTaskById } from '@/db/tasksRepo.ts'
import type { QuadrantId, QuadrantMeta } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { quadrantContainerId } from '@/ui/dnd/containers.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'
import { cn } from '@/lib/utils.ts'
import { AddTaskField } from './AddTaskField.tsx'
import { CompletedTodayList } from './CompletedTodayList.tsx'
import { QuadrantCard } from './QuadrantCard.tsx'
import { TaskRow } from './TaskRow.tsx'

export interface QuadrantSectionProps {
  quadrant: QuadrantMeta
}

/** Fora do componente: nao depende de nada do render, nao precisa recriar. */
function handleMove(task: Task, toQuadrant: QuadrantId | null): void {
  moveTaskWithUndo(task, toQuadrant).catch((error: unknown) => {
    console.error('Falha ao mover a tarefa', error)
  })
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

  const { setNodeRef, isOver } = useDroppable({ id: quadrantContainerId(quadrant.id) })

  function handleToggle(task: Task) {
    const write =
      task.status === 'open'
        ? completeTaskById(db, task.id)
        : reopenTaskById(db, task.id)

    write.catch((error: unknown) => {
      // Sem tratamento de erro dedicado: a tarefa continua visivel no
      // estado anterior, nada se perde. So registra para depurar.
      console.error('Falha ao atualizar a tarefa', error)
    })
  }

  return (
    <QuadrantCard quadrant={quadrant} openCount={openCount}>
      <AddTaskField
        quadrantVerb={quadrant.verb}
        onAdd={(title) => addTaskToQuadrant(db, quadrant.id, title)}
      />

      <SortableContext items={openTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          data-task-list={quadrant.id}
          className={cn(
            // flex-1 (nao so min-h-8) para a zona soltavel cobrir toda a
            // area visualmente vazia do card - sem isso, um quadrante vazio
            // so era soltavel numa faixa de 32px (a altura da mensagem
            // "Vazio. Ex...."), nao na area inteira que parece vazia.
            '-mx-1.5 min-h-8 flex-1 rounded-md px-1.5 transition-colors duration-150',
            // Destaque do destino durante o arraste (docs secao 5.1 e fase 1c).
            isOver && 'bg-surface-muted outline-2 outline-dashed outline-border-control',
          )}
        >
          {openTasks.length === 0 && completedToday.length === 0 ? (
            <p className="px-1 py-1 text-xs text-text-subtle">
              Vazio. Ex.: &ldquo;{quadrant.emptyExample}&rdquo;
            </p>
          ) : (
            openTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                accentClass={accentClass}
                onToggle={handleToggle}
                onMove={handleMove}
              />
            ))
          )}
        </ul>
      </SortableContext>

      <CompletedTodayList
        tasks={completedToday}
        accentClass={accentClass}
        onToggle={handleToggle}
      />
    </QuadrantCard>
  )
}
