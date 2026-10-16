import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { CaptureField } from './CaptureField.tsx'

export interface IdeiaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Folha inferior "Ideia" (`docs/prompt-anotacoes.md` seção 3.1): reusa o
 * mesmo `CaptureField` da caixa de entrada que já existe - "ideia" é
 * exatamente essa captura, não um conceito novo (seção 2). Radix foca o
 * campo sozinho ao abrir (primeiro e único elemento focável no conteúdo),
 * satisfazendo "em até 2 segundos o cursor está no editor" (seção 11) sem
 * nenhum código extra de foco.
 */
export function IdeiaSheet({ open, onOpenChange }: IdeiaSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 sm:hidden" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-lg sm:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Dialog.Title className="text-[13px] font-semibold text-text">Nova ideia</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-7 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Captura rápida para a caixa de entrada. Enter salva, limpa e mantém o campo aberto para a próxima.
          </Dialog.Description>
          <CaptureField />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
