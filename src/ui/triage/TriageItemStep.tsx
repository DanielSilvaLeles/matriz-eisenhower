import { QUADRANTS, type QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { QUADRANT_STYLES } from '@/ui/quadrantStyles.ts'
import { cn } from '@/lib/utils.ts'

export interface TriageItemStepProps {
  task: Task
  /**
   * Verdadeiro do instante em que a pessoa escolhe um destino at o passo
   * terminar (ver `busy` em TriageOverlay.tsx) - desabilita os botoes para
   * dar feedback imediato de que o clique registrou, e para um segundo
   * clique/tecla nesse intervalo nao disparar uma segunda movimentacao
   * concorrente para o mesmo item (bug real: a tarefa "voltava" porque a
   * segunda movimentacao resolvia depois e sobrescrevia o passo que a
   * primeira tinha aberto).
   */
  busy: boolean
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
export function TriageItemStep({ task, busy, onSendToQuadrant, onHelp, onEdit, onSkip }: TriageItemStepProps) {
  return (
    <>
      <div className="max-w-lg text-center">
        <p className="text-xl font-semibold text-text">{task.title}</p>
        <p className="mt-3 text-[13px] text-text-muted">
          Contribui para meus objetivos ou estou só reagindo à pressão do momento?
        </p>
      </div>

      <div className={cn('grid grid-cols-2 gap-2', busy && 'opacity-50')}>
        {QUADRANTS.map((quadrant, index) => {
          const style = QUADRANT_STYLES[quadrant.id]
          const Icon = style.icon
          return (
            <button
              key={quadrant.id}
              type="button"
              disabled={busy}
              onClick={() => {
                onSendToQuadrant(quadrant.id)
              }}
              className={cn(
                'flex min-h-20 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-border text-[13px] font-medium disabled:cursor-not-allowed',
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
          disabled={busy}
          onClick={onHelp}
          className="text-text-muted underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Me ajude a decidir
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          className="text-text-muted underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Editar (E)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="text-text-muted underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pular (S)
        </button>
      </div>
    </>
  )
}
