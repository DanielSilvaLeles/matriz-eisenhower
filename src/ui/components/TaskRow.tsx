import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion.ts'
import { cn } from '@/lib/utils.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { MoveToMenu } from './MoveToMenu.tsx'

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
  /** Ausente nas linhas de "Concluidas hoje": tarefa concluida nao se move. */
  onMove?: (task: Task, toQuadrant: QuadrantId | null) => void
}

/** Risca e some: curto e com proposito, 150-200ms (docs secao 7). */
const COMPLETE_TRANSITION_MS = 180

export function TaskRow({ task, accentClass, onToggle, onMove }: TaskRowProps) {
  const [completing, setCompleting] = useState(false)
  const isDone = task.status === 'done'
  const struck = isDone || completing

  const { attributes, setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isDone,
  })

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
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      // dnd-kit calcula a translacao do arraste em tempo real - nao da para
      // expressar isso como classe Tailwind estatica, so inline mesmo.
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group -mx-1 flex items-center gap-1 rounded-md px-1 py-1',
        isDragging && 'opacity-40',
      )}
    >
      {isDone ? (
        <span className="size-5 shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          {...listeners}
          {...attributes}
          // So ponteiro e toque: a alternativa por teclado e o atalho
          // 1-4/0 e o menu "Mover para", nao o sensor de teclado do dnd-kit
          // (que nao esta ligado - ver DndWorkspace). tabIndex -1 e
          // aria-hidden porque oferecer isto ao foco anunciaria instrucoes
          // de arrastar por teclado que nao funcionam de verdade aqui.
          tabIndex={-1}
          aria-hidden="true"
          className="-ml-0.5 inline-flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-subtle opacity-100 transition-opacity duration-150 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
      )}

      {/*
       * Checkbox e titulo dentro do mesmo <label>: a area clicavel/tocavel
       * vira a linha inteira, nao so o quadradinho de 16px - e o alvo de
       * toque de pelo menos 48px no celular (docs secao 5.7), sem inflar o
       * checkbox em si (que no desktop continua compacto).
       */}
      <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 sm:min-h-0">
        <input
          type="checkbox"
          checked={struck}
          disabled={completing}
          onChange={handleToggle}
          aria-label={isDone ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
          // Ancora da navegacao por seta (docs secao 5.6): e o elemento que
          // recebe o foco ao navegar entre tarefas, e tambem onde Espaco ja
          // concluir/reabre de graca - comportamento nativo do checkbox.
          data-task-anchor
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
      </label>

      {!isDone && onMove ? (
        <MoveToMenu
          currentQuadrant={task.quadrant}
          onMove={(toQuadrant) => {
            onMove(task, toQuadrant)
          }}
          triggerLabel={`Mover "${task.title}"`}
        />
      ) : null}
    </li>
  )
}
