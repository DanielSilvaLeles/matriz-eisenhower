import { Inbox } from 'lucide-react'
import { useInboxCount } from '@/db/hooks.ts'
import { QUADRANTS, quadrantMeta, type QuadrantId } from '@/domain/quadrant.ts'
import { CaptureField } from './CaptureField.tsx'
import { MiniQuadrantButton } from './MiniQuadrantButton.tsx'
import { MobileInboxSheet } from './MobileInboxSheet.tsx'
import { QuadrantSection } from './QuadrantSection.tsx'

export interface MobileMatrixViewProps {
  /** Controlado pelo App.tsx: a faixa "Hoje" (docs secao 5.1) precisa poder trocar o quadrante selecionado e abrir a caixa de entrada. */
  selected: QuadrantId
  onSelectedChange: (quadrant: QuadrantId) => void
  inboxOpen: boolean
  onInboxOpenChange: (open: boolean) => void
}

/**
 * Layout mobile (docs secao 5.7): quatro listas lado a lado nao cabem no
 * celular. Em vez disso, uma mini matriz 2x2 no topo funciona como seletor
 * de qual quadrante aparece embaixo, e a captura fica fixa no alcance do
 * polegar. So existe abaixo do breakpoint sm (ver App.tsx, que renderiza
 * este componente e o MatrixGrid lado a lado e o CSS decide qual mostrar -
 * nao ha deteccao de largura por JavaScript, para nao arriscar flash de
 * layout errado antes da primeira pintura).
 */
export function MobileMatrixView({
  selected,
  onSelectedChange,
  inboxOpen,
  onInboxOpenChange,
}: MobileMatrixViewProps) {
  const inboxCount = useInboxCount()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pb-14 sm:hidden">
      <button
        type="button"
        onClick={() => {
          onInboxOpenChange(true)
        }}
        aria-label={`Abrir caixa de entrada, ${inboxCount} ${inboxCount === 1 ? 'item' : 'itens'}`}
        className="flex min-h-11 w-fit shrink-0 items-center gap-1.5 self-start rounded-full border border-border bg-surface px-3 text-[13px] text-text-muted"
      >
        <Inbox className="size-4" aria-hidden="true" />
        Caixa de entrada
        {inboxCount > 0 ? (
          <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink tabular-nums">
            {inboxCount}
          </span>
        ) : null}
      </button>

      <div className="grid shrink-0 grid-cols-2 grid-rows-2 gap-1.5">
        {QUADRANTS.map((quadrant) => (
          <MiniQuadrantButton
            key={quadrant.id}
            quadrant={quadrant}
            selected={selected === quadrant.id}
            onSelect={() => {
              onSelectedChange(quadrant.id)
            }}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuadrantSection quadrant={quadrantMeta(selected)} />
      </div>

      {/*
       * Fixa na tela toda (nao so neste container), ao alcance do polegar -
       * continua visivel mesmo com a lista do quadrante rolada.
       */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] sm:hidden">
        <CaptureField />
      </div>

      <MobileInboxSheet
        open={inboxOpen}
        onClose={() => {
          onInboxOpenChange(false)
        }}
      />
    </div>
  )
}
