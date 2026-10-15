import { ChevronsRight, Inbox } from 'lucide-react'
import { useState } from 'react'
import { useInboxTasks } from '@/db/hooks.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { cn } from '@/lib/utils.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { useNowTick } from '@/ui/hooks/useNowTick.ts'
import { CaptureField, INBOX_CAPTURE_FIELD_ID } from './CaptureField.tsx'
import { InboxItemRow } from './InboxItemRow.tsx'

function handleMove(task: Task, toQuadrant: QuadrantId | null): void {
  moveTaskWithUndo(task, toQuadrant).catch((error: unknown) => {
    console.error('Falha ao mover a tarefa', error)
  })
}

/**
 * Painel lateral da caixa de entrada, fixo a direita da matriz no desktop
 * (docs secao 5.2). So a versao de telas largas - o layout mobile (fase 1c,
 * secao 5.7) usa outro componente, acessado por um chip com badge.
 */
export function InboxPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const tasks = useInboxTasks()
  const now = useNowTick()

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          setCollapsed(false)
        }}
        aria-label={`Abrir caixa de entrada, ${tasks.length} ${tasks.length === 1 ? 'item' : 'itens'}`}
        className="relative flex h-fit shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-text-muted hover:text-text"
      >
        <Inbox className="size-4" aria-hidden="true" />
        {tasks.length > 0 ? (
          <span className="rounded-full bg-focus px-1.5 text-[11px] font-semibold text-white tabular-nums">
            {tasks.length}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <aside
      aria-label="Caixa de entrada"
      className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Inbox className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold text-text">
          Caixa de entrada
          {tasks.length > 0 ? (
            <span className="ml-1.5 font-normal text-text-muted tabular-nums">
              ({tasks.length})
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true)
          }}
          aria-label="Recolher caixa de entrada"
          title="Recolher"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
        >
          <ChevronsRight className="size-4" aria-hidden="true" />
        </button>
      </header>

      <CaptureField />

      <ul
        data-task-list="inbox"
        className={cn('min-h-0 flex-1 overflow-y-auto px-2 pb-2', tasks.length === 0 && 'px-3')}
      >
        {tasks.length === 0 ? (
          <p className="pt-1 text-xs text-text-subtle">
            Vazia. Capture uma ideia acima ou pressione{' '}
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">
              N
            </kbd>{' '}
            de qualquer lugar.
          </p>
        ) : (
          tasks.map((task) => (
            <InboxItemRow key={task.id} task={task} now={now} onMove={handleMove} />
          ))
        )}
      </ul>
    </aside>
  )
}

export { INBOX_CAPTURE_FIELD_ID }
