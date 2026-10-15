import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useInboxTasks } from '@/db/hooks.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { useNowTick } from '@/ui/hooks/useNowTick.ts'
import { CaptureField } from './CaptureField.tsx'
import { InboxItemRow } from './InboxItemRow.tsx'

function handleMove(task: Task, toQuadrant: QuadrantId | null): void {
  moveTaskWithUndo(task, toQuadrant).catch((error: unknown) => {
    console.error('Falha ao mover a tarefa', error)
  })
}

export interface MobileInboxSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Versao mobile da caixa de entrada: tela cheia, aberta pelo chip com badge
 * acima da mini matriz (docs secao 5.7). No desktop quem faz esse papel e
 * o painel lateral (InboxPanel.tsx) - componentes diferentes porque o
 * layout e genuinamente diferente, nao so um reposicionamento por CSS.
 */
export function MobileInboxSheet({ open, onClose }: MobileInboxSheetProps) {
  const tasks = useInboxTasks()
  const now = useNowTick()

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-3">
            <Dialog.Title className="text-[15px] font-semibold text-text">
              Caixa de entrada
              {tasks.length > 0 ? (
                <span className="ml-1.5 font-normal text-text-muted tabular-nums">
                  ({tasks.length})
                </span>
              ) : null}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </header>

          <Dialog.Description className="sr-only">
            Itens capturados ainda não classificados num quadrante.
          </Dialog.Description>

          <div className="shrink-0 border-b border-border">
            <CaptureField />
          </div>

          <ul data-task-list="inbox" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {tasks.length === 0 ? (
              <p className="px-1 pt-2 text-sm text-text-subtle">
                Vazia. Capture uma ideia acima.
              </p>
            ) : (
              tasks.map((task) => (
                <InboxItemRow key={task.id} task={task} now={now} onMove={handleMove} />
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
