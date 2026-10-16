import { Inbox } from 'lucide-react'
import { useInboxCount } from '@/db/hooks.ts'
import { QUADRANTS, quadrantMeta, type QuadrantId } from '@/domain/quadrant.ts'
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
 * de qual quadrante aparece embaixo. So existe abaixo do breakpoint sm
 * (ver App.tsx, que decide via useMediaQuery - nao ha deteccao de largura
 * so por CSS, para nao arriscar duas arvores montadas ao mesmo tempo).
 *
 * A captura fixa na base foi substituída pelo menu inferior "Ideia"/
 * "Anotar" (`docs/prompt-anotacoes.md` seção 3.1 - `MobileQuickActions.tsx`,
 * montado por `App.tsx`) - nunca as duas barras empilhadas, por isso este
 * componente não renderiza mais nenhuma barra fixa própria, só reserva o
 * espaço (`pb-14`) para a barra que `App.tsx` desenha por cima.
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

      <MobileInboxSheet
        open={inboxOpen}
        onClose={() => {
          onInboxOpenChange(false)
        }}
      />
    </div>
  )
}
