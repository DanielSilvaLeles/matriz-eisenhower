import { useOpenTaskCount } from '@/db/hooks.ts'
import {
  MAX_OPEN_TASKS,
  isAtOrOverLimit,
  isNearLimit,
  type QuadrantMeta,
} from '@/domain/quadrant.ts'
import { cn } from '@/lib/utils.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'

export interface MiniQuadrantButtonProps {
  quadrant: QuadrantMeta
  selected: boolean
  onSelect: () => void
}

/**
 * Uma celula da mini matriz 2x2 do mobile (docs secao 5.7): cor, verbo e
 * contador, funcionando como seletor de qual lista aparece embaixo. 48px de
 * altura minima - alvo de toque.
 */
export function MiniQuadrantButton({ quadrant, selected, onSelect }: MiniQuadrantButtonProps) {
  const count = useOpenTaskCount(quadrant.id)
  const style = QUADRANT_STYLES[quadrant.id]
  const Icon = style.icon
  const warn = isNearLimit(count) || isAtOrOverLimit(count)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${quadrant.verb}. ${count} de ${MAX_OPEN_TASKS} tarefas abertas.`}
      className={cn(
        'flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors duration-150',
        selected ? cn('border-transparent', style.soft) : 'border-border bg-surface',
      )}
    >
      <span className={cn('flex items-center gap-1 text-[13px] font-semibold', style.ink)}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {quadrant.verb}
      </span>
      <span
        className={cn(
          'text-[11px] tabular-nums',
          warn ? 'font-semibold text-warn' : 'text-text-muted',
        )}
      >
        {count}/{MAX_OPEN_TASKS}
      </span>
    </button>
  )
}
