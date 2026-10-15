import { useInboxCount, useOpenTaskCount, useScheduledTodayCount } from '@/db/hooks.ts'
import { useToday } from '@/ui/hooks/useNowTick.ts'

export type TodayTarget = 'q1' | 'q2' | 'q3' | 'inbox'

export interface TodayBarProps {
  /** "Leva ao lugar certo" (docs secao 5.1) - App.tsx decide o que isso significa em cada layout. */
  onNavigate: (target: TodayTarget) => void
}

/**
 * Faixa "Hoje" no topo (docs secao 5.1): quantas em Fazer, quantas
 * agendadas para hoje, quantas cobranças vencem hoje e quantos itens na
 * caixa de entrada - cada número clicável. So os quatro numeros que o
 * documento pede; Q4 nao entra aqui (nao tem o conceito de "hoje").
 */
export function TodayBar({ onNavigate }: TodayBarProps) {
  const today = useToday()
  const fazer = useOpenTaskCount('q1')
  const agendadasHoje = useScheduledTodayCount('q2', today)
  const cobrancasHoje = useScheduledTodayCount('q3', today)
  const inboxCount = useInboxCount()

  const items: ReadonlyArray<{ target: TodayTarget; count: number; label: string }> = [
    { target: 'q1', count: fazer, label: 'em Fazer' },
    { target: 'q2', count: agendadasHoje, label: 'agendadas para hoje' },
    { target: 'q3', count: cobrancasHoje, label: 'cobranças vencem hoje' },
    { target: 'inbox', count: inboxCount, label: 'na caixa de entrada' },
  ]

  return (
    <div
      role="toolbar"
      aria-label="Resumo de hoje"
      className="flex shrink-0 flex-wrap items-center gap-1 text-[13px] text-text-muted"
    >
      <span className="mr-1 text-xs font-semibold tracking-wide text-text-subtle uppercase">
        Hoje
      </span>
      {items.map((item) => (
        <button
          key={item.target}
          type="button"
          onClick={() => {
            onNavigate(item.target)
          }}
          className="rounded-md px-1.5 py-1 hover:bg-surface-muted hover:text-text"
        >
          <span className="font-semibold tabular-nums text-text">{item.count}</span> {item.label}
        </button>
      ))}
    </div>
  )
}
