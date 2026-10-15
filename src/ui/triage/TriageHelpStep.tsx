import { useState } from 'react'
import { quadrantFor, quadrantMeta } from '@/domain/quadrant.ts'
import { cn } from '@/lib/utils.ts'

export interface TriageHelpStepProps {
  onConfirm: (urgent: boolean, important: boolean) => void
  onCancel: () => void
}

function YesNoQuestion({
  question,
  value,
  onChange,
}: {
  question: string
  value: boolean | null
  onChange: (next: boolean) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-text">{question}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            onChange(true)
          }}
          aria-pressed={value === true}
          className={cn(
            'flex-1 rounded-md border px-3 py-1.5 text-[13px]',
            value === true
              ? 'border-focus bg-surface-muted font-medium text-text'
              : 'border-border text-text-muted hover:bg-surface-muted',
          )}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(false)
          }}
          aria-pressed={value === false}
          className={cn(
            'flex-1 rounded-md border px-3 py-1.5 text-[13px]',
            value === false
              ? 'border-focus bg-surface-muted font-medium text-text'
              : 'border-border text-text-muted hover:bg-surface-muted',
          )}
        >
          Não
        </button>
      </div>
    </div>
  )
}

/**
 * "Me ajude a decidir" (docs secao 5.3): duas perguntas de sim ou não, e a
 * sugestão sai de `quadrantFor` (regra simples, sem IA) - a mesma função
 * que define os quatro quadrantes no domínio (src/domain/quadrant.ts).
 */
export function TriageHelpStep({ onConfirm, onCancel }: TriageHelpStepProps) {
  const [urgent, setUrgent] = useState<boolean | null>(null)
  const [important, setImportant] = useState<boolean | null>(null)

  const suggestion = urgent === null || important === null ? null : quadrantFor(urgent, important)

  return (
    <div className="w-full max-w-sm space-y-4">
      <YesNoQuestion
        question="Tem prazo ou consequência próxima?"
        value={urgent}
        onChange={setUrgent}
      />
      <YesNoQuestion
        question="Aproxima dos meus objetivos de longo prazo?"
        value={important}
        onChange={setImportant}
      />

      {suggestion === null ? null : (
        <p className="text-center text-[13px] text-text-muted">
          Sugestão: <span className="font-semibold text-text">{quadrantMeta(suggestion).verb}</span>
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-border px-3 py-1.5 text-[13px] text-text-muted hover:bg-surface-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={suggestion === null}
          onClick={() => {
            if (urgent !== null && important !== null) onConfirm(urgent, important)
          }}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-50"
        >
          Mandar
        </button>
      </div>
    </div>
  )
}
