import { DropdownMenu } from 'radix-ui'
import { MoveRight } from 'lucide-react'
import { QUADRANTS, type QuadrantId } from '@/domain/quadrant.ts'

export interface MoveToMenuProps {
  /** Quadrante atual (ou `null` na caixa de entrada) - fica fora da lista de destinos. */
  currentQuadrant: QuadrantId | null
  onMove: (toQuadrant: QuadrantId | null) => void
  /** Rotulo acessivel do gatilho, ex.: `Mover "Revisar PR do time"`. */
  triggerLabel: string
}

interface Destination {
  readonly id: QuadrantId | null
  readonly label: string
}

const ALL_DESTINATIONS: readonly Destination[] = [
  ...QUADRANTS.map((q) => ({ id: q.id, label: q.verb })),
  { id: null, label: 'Caixa de entrada' },
]

/**
 * Alternativa por toque e teclado ao arrastar (docs secao 4.5 e 5.1): "Mover
 * para" ao lado de cada tarefa. Radix DropdownMenu cuida do foco, Escape e
 * navegacao por seta dentro do menu - nao e reinventado aqui.
 */
export function MoveToMenu({ currentQuadrant, onMove, triggerLabel }: MoveToMenuProps) {
  const destinations = ALL_DESTINATIONS.filter((d) => d.id !== currentQuadrant)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          title="Mover para"
          // Sempre visivel ate o breakpoint sm: toque nao tem :hover
          // confiavel, entao esconder ate o gesto errado deixaria o botao
          // inalcancavel no celular. So some por hover a partir do desktop.
          // size-12 (48px) no celular e o alvo de toque minimo (docs 5.7);
          // no desktop volta a ser compacto (size-6).
          className="inline-flex size-12 shrink-0 items-center justify-center rounded text-text-subtle opacity-100 transition-opacity duration-150 hover:bg-surface-muted hover:text-text sm:size-6 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
        >
          <MoveRight className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-36 rounded-md border border-border bg-surface py-1 text-[13px] text-text shadow-lg"
        >
          {destinations.map((destination) => (
            <DropdownMenu.Item
              key={destination.id ?? 'inbox'}
              onSelect={() => {
                onMove(destination.id)
              }}
              className="cursor-pointer px-3 py-1.5 outline-none select-none data-highlighted:bg-surface-muted"
            >
              {destination.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
