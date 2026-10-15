import { QUADRANTS, type QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'
import { cn } from '@/lib/utils.ts'

export interface TriageItemStepProps {
  task: Task
  onSendToQuadrant: (quadrant: QuadrantId) => void
  onHelp: () => void
  onEdit: () => void
  onSkip: () => void
}

/**
 * O item grande no centro + a mini matriz 2x2 com os quatro destinos, na
 * mesma posição espacial da home (docs secao 5.3) - teclas `1`-`4` fazem o
 * mesmo que clicar (ver TriageOverlay.tsx, que escuta o teclado).
 */
export function TriageItemStep({ task, onSendToQuadrant, onHelp, onEdit, onSkip }: TriageItemStepProps) {
  return (
    <>
      <div className="max-w-lg text-center">
        <p className="text-xl font-semibold text-text">{task.title}</p>
        <p className="mt-3 text-[13px] text-text-muted">
          Contribui para meus objetivos ou estou só reagindo à pressão do momento?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUADRANTS.map((quadrant, index) => {
          const style = QUADRANT_STYLES[quadrant.id]
          const Icon = style.icon
          return (
            <button
              key={quadrant.id}
              type="button"
              onClick={() => {
                onSendToQuadrant(quadrant.id)
              }}
              className={cn(
                'flex min-h-20 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-border text-[13px] font-medium',
                style.soft,
                style.ink,
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {quadrant.verb}
              <span className="text-[11px] font-normal text-text-subtle">{index + 1}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 text-[13px]">
        <button
          type="button"
          onClick={onHelp}
          className="text-text-muted underline-offset-2 hover:underline"
        >
          Me ajude a decidir
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="text-text-muted underline-offset-2 hover:underline"
        >
          Editar (E)
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-text-muted underline-offset-2 hover:underline"
        >
          Pular (S)
        </button>
      </div>
    </>
  )
}
