import { useWeeklyReview } from '@/db/hooks.ts'
import { formatInboxDuration } from '@/domain/weeklyReview.ts'
import { QUADRANTS } from '@/domain/quadrant.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'
import { cn } from '@/lib/utils.ts'

/**
 * Revisão semanal (docs secao 5.9): distribuição das concluídas por
 * quadrante, quantas tarefas de Q1 vieram de Q2 atrasado (sinal de falha de
 * planejamento - docs secao 3, princípio 1), tempo médio parado na caixa de
 * entrada e quantas foram eliminadas. Segunda-feira até agora.
 */
export function WeeklyReviewSection() {
  const stats = useWeeklyReview()

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
          Concluídas por quadrante
        </h3>
        <div className="grid grid-cols-4 gap-1.5">
          {QUADRANTS.map((quadrant) => {
            const style = QUADRANT_STYLES[quadrant.id]
            return (
              <div
                key={quadrant.id}
                className={cn('rounded-md px-2 py-1.5 text-center', style.soft)}
              >
                <p className={cn('text-lg font-semibold tabular-nums', style.ink)}>
                  {stats.completedByQuadrant[quadrant.id]}
                </p>
                <p className="text-[11px] text-text-muted">{quadrant.verb}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-2 text-[13px] text-text">
        <p>
          <span className="font-semibold tabular-nums">{stats.cameFromOverdueQ2ToQ1}</span>{' '}
          {stats.cameFromOverdueQ2ToQ1 === 1
            ? 'tarefa chegou em Fazer vinda de Agendar já atrasada'
            : 'tarefas chegaram em Fazer vindas de Agendar já atrasadas'}
        </p>
        <p>
          Tempo médio parado na caixa de entrada:{' '}
          <span className="font-semibold">
            {stats.averageInboxMinutes === null
              ? '—'
              : formatInboxDuration(stats.averageInboxMinutes)}
          </span>
        </p>
        <p>
          <span className="font-semibold tabular-nums">{stats.eliminatedCount}</span>{' '}
          {stats.eliminatedCount === 1 ? 'tarefa eliminada' : 'tarefas eliminadas'}
        </p>
      </section>
    </div>
  )
}
