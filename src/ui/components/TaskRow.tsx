import { useState } from 'react'
import { cn } from '@/lib/utils.ts'
import { prefersReducedMotion } from '@/lib/motion.ts'
import type { Task } from '@/domain/schema.ts'

export interface TaskRowProps {
  task: Task
  /** Classe `accent-qN` do quadrante, para o checkbox usar a cor certa. */
  accentClass: string
  /**
   * Chamado para concluir ou reabrir, conforme `task.status` - quem decide
   * qual repositorio chamar e o container (QuadrantSection), que tem acesso
   * ao banco; TaskRow so sabe desenhar e animar.
   */
  onToggle: (task: Task) => void
}

/** Risca e some: curto e com proposito, 150-200ms (docs secao 7). */
const COMPLETE_TRANSITION_MS = 180

export function TaskRow({ task, accentClass, onToggle }: TaskRowProps) {
  const [completing, setCompleting] = useState(false)
  const isDone = task.status === 'done'
  const struck = isDone || completing

  function handleToggle() {
    if (isDone) {
      onToggle(task)
      return
    }
    if (prefersReducedMotion()) {
      onToggle(task)
      return
    }
    // Risca na hora (feedback instantaneo) e so grava a conclusao depois de
    // a animacao ter tempo de aparecer - do contrario a tarefa some da
    // lista antes de a pessoa ver o risco.
    setCompleting(true)
    window.setTimeout(() => {
      onToggle(task)
    }, COMPLETE_TRANSITION_MS)
  }

  return (
    <li className="-mx-1 flex items-center gap-2 rounded-md px-1 py-1">
      <input
        type="checkbox"
        checked={struck}
        disabled={completing}
        onChange={handleToggle}
        aria-label={isDone ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
        className={cn('size-4 shrink-0 cursor-pointer', accentClass)}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] transition-[opacity,color] duration-150',
          struck ? 'text-text-subtle line-through opacity-70' : 'text-text',
        )}
      >
        {task.title}
      </span>
    </li>
  )
}
