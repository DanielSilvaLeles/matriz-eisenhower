import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { helpOpenStore } from '@/ui/help/store.ts'
import { useHelpOpen } from '@/ui/help/useHelpOpen.ts'

interface ShortcutEntry {
  readonly keys: readonly string[]
  readonly description: string
}

/**
 * So os atalhos que ja fazem algo nesta fase. `Enter`, `T` e `S` ficam de
 * fora de proposito - ver o comentario em useGlobalShortcuts.ts.
 */
const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: ['N'], description: 'Focar a captura, de qualquer lugar' },
  { keys: ['↑', '↓', '←', '→'], description: 'Navegar entre as tarefas da lista focada' },
  { keys: ['1', '2', '3', '4'], description: 'Mover a tarefa focada para Fazer/Agendar/Delegar/Eliminar' },
  { keys: ['0'], description: 'Devolver a tarefa focada para a caixa de entrada' },
  { keys: ['Espaço'], description: 'Concluir ou reabrir a tarefa focada' },
  { keys: ['Ctrl', 'Z'], description: 'Desfazer a última ação' },
  { keys: ['?'], description: 'Abrir esta ajuda' },
]

export function HelpOverlay() {
  const open = useHelpOpen()

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        helpOpenStore.set(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <Dialog.Title className="text-[15px] font-semibold text-text">
              Atalhos de teclado
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Lista dos atalhos de teclado disponíveis na matriz.
          </Dialog.Description>

          <dl className="space-y-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.description} className="flex items-center justify-between gap-3">
                <dt className="flex shrink-0 gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded border border-border-strong bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-text"
                    >
                      {key}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-right text-[13px] text-text-muted">{shortcut.description}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
