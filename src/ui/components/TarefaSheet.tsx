import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { CaptureField, INBOX_CAPTURE_FIELD_ID } from './CaptureField.tsx'

export interface TarefaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Folha inferior "Tarefa" (renomeada de "Ideia" a pedido do usuário -
 * `docs/prompt-anotacoes.md` seção 3.1 ainda chama o conceito de "ideia",
 * mas a interface usa "Tarefa" desde esta mudança): reusa o mesmo
 * `CaptureField` da caixa de entrada que já existe - captura rápida, não
 * um conceito novo.
 *
 * **`onOpenAutoFocus` explícito, não o padrão do Radix** - relatado pelo
 * usuário em uso real: o teclado do celular não abria ao tocar no botão.
 * Sem foco em nenhum elemento com `autoFocus` nativo dentro do conteúdo, o
 * Radix foca o próprio `Dialog.Content` (um `<div>`), não o `<input>` -
 * diferente de `NoteEditorForm.tsx` (que tem `autoFocus` no `<textarea>`)
 * ou do atalho `N`/botão "+" do desktop (`useGlobalShortcuts.ts`/
 * `DesktopNav.tsx`, que já focam o campo por id manualmente).
 * `CaptureField` não pode ganhar `autoFocus` direto no `<input>` porque é
 * reusado em `InboxPanel.tsx` (painel sempre visível do desktop) e
 * `MobileInboxSheet.tsx` (lista da caixa de entrada) - nos dois, abrir/
 * renderizar não deve roubar o foco. `event.preventDefault()` cancela o
 * foco padrão do Radix (que iria para o `Dialog.Content`) antes de focar o
 * campo certo - mesmo id (`INBOX_CAPTURE_FIELD_ID`) que o resto do app já
 * usa para isso, satisfazendo "em até 2 segundos o cursor está no editor"
 * (docs secao 11) de verdade, não só na teoria.
 */
export function TarefaSheet({ open, onOpenChange }: TarefaSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 sm:hidden" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector<HTMLElement>(`#${INBOX_CAPTURE_FIELD_ID}`)?.focus()
          }}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-lg sm:hidden"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <Dialog.Title className="text-[13px] font-semibold text-text">Nova tarefa</Dialog.Title>
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
