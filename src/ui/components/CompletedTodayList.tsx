import { TaskRow } from './TaskRow.tsx'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'

export interface CompletedTodayListProps {
  tasks: readonly Task[]
  quadrant: QuadrantId
  today: string
  accentClass: string
  onToggle: (task: Task) => void
}

/**
 * Rodape colapsado "Concluidas hoje (n)" (docs secao 5.1). `<details>` nativo:
 * teclado, toque e leitor de tela funcionam sem nenhum JS de abrir/fechar.
 */
export function CompletedTodayList({
  tasks,
  quadrant,
  today,
  accentClass,
  onToggle,
}: CompletedTodayListProps) {
  if (tasks.length === 0) return null

  return (
    <details className="mt-1 border-t border-border pt-2">
      <summary className="cursor-pointer text-xs text-text-muted select-none">
        Concluídas hoje ({tasks.length})
      </summary>
      <ul className="mt-1.5">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            quadrant={quadrant}
            today={today}
            accentClass={accentClass}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </details>
  )
}
