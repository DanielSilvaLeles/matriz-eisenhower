import { Ban, CalendarClock, Forward, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils.ts'
import {
  MAX_OPEN_TASKS,
  isAtOrOverLimit,
  isNearLimit,
  type QuadrantId,
  type QuadrantMeta,
} from '@/domain/quadrant.ts'

/**
 * Estilo por quadrante.
 *
 * Mapa estatico, e nao `bg-${id}` montado em tempo de execucao: o Tailwind
 * precisa ver a classe escrita no codigo para gera-la no CSS.
 *
 * A cor entra so como acento - barra fina no topo, icone e um tom bem leve
 * no cabecalho. O quadrante nunca e preenchido de cor saturada (docs secao 7).
 */
const STYLES: Record<
  QuadrantId,
  { bar: string; ink: string; soft: string; icon: LucideIcon; recessed: boolean }
> = {
  q1: { bar: 'bg-q1', ink: 'text-q1-ink', soft: 'bg-q1-soft', icon: Zap, recessed: false },
  q2: {
    bar: 'bg-q2',
    ink: 'text-q2-ink',
    soft: 'bg-q2-soft',
    icon: CalendarClock,
    recessed: false,
  },
  q3: {
    bar: 'bg-q3',
    ink: 'text-q3-ink',
    soft: 'bg-q3-soft',
    icon: Forward,
    recessed: false,
  },
  // Q4 fica visualmente recuado para a hierarquia da tela refletir a
  // prioridade real: o que nao importa nem urge nao deve puxar o olho.
  // Recuar e afundar em direcao ao fundo da pagina, nos dois temas - por isso
  // surface-sunken, e nao surface-muted (que no tema escuro e mais claro que
  // a superficie normal e faria o Q4 saltar justamente ao contrario).
  q4: { bar: 'bg-q4', ink: 'text-q4-ink', soft: 'bg-q4-soft', icon: Ban, recessed: true },
}

export interface QuadrantCardProps {
  quadrant: QuadrantMeta
  /** Tarefas abertas no quadrante. */
  openCount: number
}

export function QuadrantCard({ quadrant, openCount }: QuadrantCardProps) {
  const style = STYLES[quadrant.id]
  const Icon = style.icon

  const full = isAtOrOverLimit(openCount)
  const near = isNearLimit(openCount)

  return (
    <section
      // O nome acessivel ja carrega os dois eixos, por isso os rotulos
      // visuais da grade podem ficar fora da arvore de acessibilidade.
      aria-label={`${quadrant.verb}. ${quadrant.support}.`}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border',
        style.recessed ? 'bg-surface-sunken' : 'bg-surface',
      )}
    >
      <div className={cn('h-[3px] shrink-0', style.bar)} aria-hidden="true" />

      <header
        className={cn(
          'flex items-start gap-2 border-b border-border px-3 py-2.5',
          style.soft,
        )}
      >
        <Icon className={cn('mt-px size-4 shrink-0', style.ink)} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <h2 className={cn('text-[15px] leading-tight font-semibold', style.ink)}>
            {quadrant.verb}
          </h2>
          {/*
           * Em tela estreita a linha de apoio quebraria em duas ou tres linhas
           * e deixaria os cabecalhos dos quatro quadrantes com alturas
           * diferentes. O verbo, o icone e a posicao na grade ja dizem o que
           * e cada quadrante.
           */}
          <p className="mt-0.5 hidden text-xs text-text-muted sm:block">
            {quadrant.support}
          </p>
        </div>

        <span
          className={cn(
            'shrink-0 text-xs',
            near || full ? 'font-semibold text-warn' : 'text-text-muted',
          )}
        >
          <span className="sr-only">
            {openCount} de {MAX_OPEN_TASKS} tarefas abertas.{' '}
          </span>
          <span aria-hidden="true">
            {openCount}/{MAX_OPEN_TASKS}
          </span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        {openCount === 0 ? (
          <p className="text-xs text-text-subtle">
            Vazio. Ex.: &ldquo;{quadrant.emptyExample}&rdquo;
          </p>
        ) : null}
      </div>
    </section>
  )
}
