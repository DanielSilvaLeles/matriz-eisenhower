import { Dialog } from 'radix-ui'
import { History, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useHistoryTasks } from '@/db/hooks.ts'
import { getDB } from '@/db/schema.ts'
import { restoreTaskFromHistory } from '@/db/tasksRepo.lifecycle.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { MoveToMenu } from './MoveToMenu.tsx'

function statusLabel(status: Task['status']): string {
  return status === 'archived' ? 'Eliminada' : 'Concluída'
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function matchesQuery(task: Task, query: string): boolean {
  if (query.trim() === '') return true
  return task.title.toLowerCase().includes(query.trim().toLowerCase())
}

function handleRestore(task: Task, toQuadrant: QuadrantId | null): void {
  restoreTaskFromHistory(getDB(), task.id, toQuadrant).catch((error: unknown) => {
    console.error('Falha ao restaurar a tarefa', error)
  })
}

/**
 * Histórico pesquisável (docs secao 5.9): concluídas e eliminadas, com
 * restaurar. So abre por este botao - sem atalho de teclado dedicado (fora
 * da lista de docs secao 5.6), por isso o estado fica local, nao num store
 * compartilhado.
 */
export function HistoryPanel() {
  const [open, setOpen] = useState(false)
  const tasks = useHistoryTasks()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => tasks.filter((task) => matchesQuery(task, query)),
    [tasks, query],
  )

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Histórico"
          title="Histórico"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
        >
          <History className="size-4" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <Dialog.Title className="text-[15px] font-semibold text-text">Histórico</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Tarefas concluídas e eliminadas, com opção de restaurar.
          </Dialog.Description>

          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder="Buscar pelo título…"
            autoComplete="off"
            className="mb-3 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-subtle focus-visible:border-focus"
          />

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-2 text-xs text-text-subtle">
                {tasks.length === 0
                  ? 'Nenhuma tarefa concluída ou eliminada ainda.'
                  : 'Nada encontrado.'}
              </p>
            ) : (
              filtered.map((task) => (
                <li
                  key={task.id}
                  // `group`: o gatilho do MoveToMenu ("Restaurar") so aparece
                  // em hover/foco a partir do breakpoint `sm` - sem um
                  // ancestral `.group`, ficaria invisivel para sempre aqui
                  // (mesmo bug encontrado e corrigido no TaskDetailPanel).
                  className="group flex items-center gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-text">{task.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-subtle">
                      {statusLabel(task.status)} · {formatHistoryDate(task.updated_at)}
                    </p>
                  </div>
                  <MoveToMenu
                    currentQuadrant={null}
                    onMove={(toQuadrant) => {
                      handleRestore(task, toQuadrant)
                    }}
                    triggerLabel={`Restaurar "${task.title}"`}
                  />
                </li>
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
