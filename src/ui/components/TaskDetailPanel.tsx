import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { usePeopleNames, useTask, useTaskEvents } from '@/db/hooks.ts'
import { quadrantMeta, type QuadrantId } from '@/domain/quadrant.ts'
import type { TaskEvent } from '@/domain/schema.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { selectedTaskIdStore } from '@/ui/detail/store.ts'
import { useSelectedTaskId } from '@/ui/detail/useSelectedTaskId.ts'
import { cn } from '@/lib/utils.ts'
import { MoveToMenu } from './MoveToMenu.tsx'
import { TaskDetailFields } from './TaskDetailFields.tsx'

function destinationName(quadrant: QuadrantId | null): string {
  return quadrant === null ? 'Caixa de entrada' : quadrantMeta(quadrant).verb
}

const EVENT_VERB: Record<TaskEvent['type'], string> = {
  created: 'Criada',
  moved: 'Movida',
  completed: 'Concluída',
  reopened: 'Reaberta',
  archived: 'Eliminada',
}

function formatEventAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function eventLabel(event: TaskEvent): string {
  const verb = EVENT_VERB[event.type]
  if (event.type === 'moved') {
    return `${verb} de ${destinationName(event.from_quadrant)} para ${destinationName(event.to_quadrant)}`
  }
  return verb
}

function closeDetail(): void {
  selectedTaskIdStore.set(null)
}

function Timeline({ taskId }: { taskId: string }) {
  const events = useTaskEvents(taskId)
  if (events.length === 0) return null

  return (
    <div className="shrink-0 border-t border-border px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
        Linha do tempo
      </h3>
      <ul className="space-y-1">
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-text-muted">{eventLabel(event)}</span>
            <span className="shrink-0 tabular-nums text-text-subtle">
              {formatEventAt(event.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Painel lateral de detalhe (docs secao 5.5): titulo, notas, quadrante,
 * data, delegacao, tags e linha do tempo - salva sozinho ao editar (sem
 * botao "Salvar"). Aberto pelo botao de cada TaskRow ou pelo atalho `Enter`
 * na tarefa focada (useGlobalShortcuts.ts), via o store compartilhado em
 * src/ui/detail/store.ts.
 */
export function TaskDetailPanel() {
  const taskId = useSelectedTaskId()
  const task = useTask(taskId)
  const peopleNames = usePeopleNames()

  return (
    <Dialog.Root
      open={taskId !== null}
      onOpenChange={(next) => {
        if (!next) closeDetail()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-[min(26rem,100vw)] flex-col border-l border-border bg-surface',
            'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
          )}
        >
          {task ? (
            <>
              {/*
               * `group`: o gatilho do MoveToMenu só aparece em hover/foco a
               * partir do breakpoint `sm` (ver MoveToMenu.tsx) - sem um
               * ancestral `.group` aqui, ele ficaria invisível para sempre
               * neste painel (TaskRow já tem o próprio `group` na `<li>`,
               * mas aqui é um cabeçalho novo, sem essa classe por padrão).
               */}
              <header className="group flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                <Dialog.Title className="sr-only">Detalhe da tarefa</Dialog.Title>
                <MoveToMenu
                  currentQuadrant={task.quadrant}
                  onMove={(toQuadrant) => {
                    moveTaskWithUndo(task, toQuadrant).catch((error: unknown) => {
                      console.error('Falha ao mover a tarefa', error)
                    })
                  }}
                  triggerLabel={`Mover "${task.title}"`}
                />
                <span className="text-xs text-text-muted">{destinationName(task.quadrant)}</span>
                <Dialog.Close
                  aria-label="Fechar"
                  className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
                >
                  <X className="size-4" aria-hidden="true" />
                </Dialog.Close>
              </header>

              <Dialog.Description className="sr-only">
                Editar título, notas, data, delegação e tags da tarefa selecionada.
              </Dialog.Description>

              <TaskDetailFields key={task.id} task={task} peopleNames={peopleNames} />
              <Timeline taskId={task.id} />
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
