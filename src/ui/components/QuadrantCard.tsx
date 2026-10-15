import type { ReactNode } from 'react'
import { cn } from '@/lib/utils.ts'
import {
  MAX_OPEN_TASKS,
  isAtOrOverLimit,
  isNearLimit,
  type QuadrantMeta,
} from '@/domain/quadrant.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'

export interface QuadrantCardProps {
  quadrant: QuadrantMeta
  /** Tarefas abertas no quadrante. */
  openCount: number
  /** Reforco positivo no rodape, ex.: "3 eliminadas esta semana" (docs secao 5.4, so Q4). */
  footerNote?: string | null
  children: ReactNode
}

export function QuadrantCard({ quadrant, openCount, footerNote, children }: QuadrantCardProps) {
  const style = QUADRANT_STYLES[quadrant.id]
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

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5">
        {children}

        {full ? (
          // Avisa, nunca bloqueia: "nunca perca uma captura" (docs secao 5.1)
          // vale mais do que manter a contagem redonda.
          <output className="block text-xs text-warn">
            Quadrante cheio: conclua, divida ou reclassifique.
          </output>
        ) : null}

        {footerNote !== null && footerNote !== undefined ? (
          <p className="text-xs text-text-subtle">{footerNote}</p>
        ) : null}
      </div>
    </section>
  )
}
