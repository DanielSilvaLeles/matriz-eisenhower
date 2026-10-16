import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { isStaleInInbox, relativeTimeFromNow } from '@/domain/time.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task, TaskSource } from '@/domain/schema.ts'
import { cn } from '@/lib/utils.ts'
import { MoveToMenu } from './MoveToMenu.tsx'

const SOURCE_LABEL: Record<TaskSource, string> = {
  web: 'Web',
  pwa: 'App',
  share: 'Compartilhado',
  note: 'Anotação',
}

export interface InboxItemRowProps {
  task: Task
  /** Instante atual, recebido do painel (que o atualiza a cada minuto). */
  now: string
  onMove: (task: Task, toQuadrant: QuadrantId | null) => void
}

export function InboxItemRow({ task, now, onMove }: InboxItemRowProps) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  })
  const stale = isStaleInInbox(task.created_at, now)

  return (
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      // Sem checkbox aqui (o item ainda nao foi triado), entao a propria
      // linha e a ancora de foco e de navegacao por seta - mesmo padrao de
      // lista navegavel por teclado sem acao padrao no Enter (como a lista
      // de e-mails do Gmail). Nao tem um elemento nativo mais apropriado
      // sem inventar um botao sem acao de verdade.
      data-task-anchor
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- ver comentario acima.
      tabIndex={0}
      className={cn(
        'group -mx-1 flex min-h-12 items-center gap-1 rounded-md px-1 py-1.5 sm:min-h-0 sm:items-start',
        isDragging && 'opacity-0',
      )}
    >
      <button
        type="button"
        {...listeners}
        // So ponteiro e toque - mesma razao do handle em TaskRow.tsx: nao
        // ligamos o sensor de teclado do dnd-kit, entao as instrucoes de
        // arrastar por teclado que 'attributes' traria seriam enganosas.
        tabIndex={-1}
        aria-hidden="true"
        className="mt-0.5 -ml-0.5 inline-flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-subtle opacity-100 transition-opacity duration-150 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-text">{task.title}</p>
        <p
          className={cn(
            'mt-0.5 text-[11px]',
            stale ? 'font-medium text-warn' : 'text-text-subtle',
          )}
        >
          {SOURCE_LABEL[task.source]} · {relativeTimeFromNow(task.created_at, now)}
        </p>
      </div>

      <MoveToMenu
        currentQuadrant={null}
        onMove={(toQuadrant) => {
          onMove(task, toQuadrant)
        }}
        triggerLabel={`Mover "${task.title}"`}
      />
    </li>
  )
}
