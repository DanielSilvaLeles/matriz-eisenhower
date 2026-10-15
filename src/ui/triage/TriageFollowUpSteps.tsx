import { useEffect, useId, useRef, useState } from 'react'
import { nextWeekMonday, thisWeekFriday, tomorrow } from '@/domain/dateStatus.ts'

export interface TriageDateStepProps {
  taskTitle: string
  today: string
  onPick: (date: string) => void
  onSkip: () => void
}

/**
 * Chips de data depois de escolher Agendar (docs secao 5.3): "Amanhã",
 * "Esta semana", "Semana que vem" ou "Escolher" - pode pular.
 */
export function TriageDateStep({ taskTitle, today, onPick, onSkip }: TriageDateStepProps) {
  const [picking, setPicking] = useState(false)
  const [custom, setCustom] = useState('')

  return (
    <div className="w-full max-w-sm space-y-3 text-center">
      <p className="text-[13px] text-text-muted">
        Quando agendar <span className="font-medium text-text">&ldquo;{taskTitle}&rdquo;</span>?
      </p>

      {picking ? (
        <div className="flex items-center justify-center gap-2">
          <input
            type="date"
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value)
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
          />
          <button
            type="button"
            disabled={custom === ''}
            onClick={() => {
              onPick(custom)
            }}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onPick(tomorrow(today))
            }}
            className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text hover:bg-surface-muted"
          >
            Amanhã
          </button>
          <button
            type="button"
            onClick={() => {
              onPick(thisWeekFriday(today))
            }}
            className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text hover:bg-surface-muted"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => {
              onPick(nextWeekMonday(today))
            }}
            className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text hover:bg-surface-muted"
          >
            Semana que vem
          </button>
          <button
            type="button"
            onClick={() => {
              setPicking(true)
            }}
            className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text hover:bg-surface-muted"
          >
            Escolher
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-text-subtle underline-offset-2 hover:underline"
      >
        Pular
      </button>
    </div>
  )
}

export interface TriageDelegateStepProps {
  taskTitle: string
  peopleNames: readonly string[]
  onPick: (name: string) => void
  onSkip: () => void
}

/** "Para quem?" com autocomplete depois de escolher Delegar (docs secao 5.3) - pode pular. */
export function TriageDelegateStep({
  taskTitle,
  peopleNames,
  onPick,
  onSkip,
}: TriageDelegateStepProps) {
  const [name, setName] = useState('')
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Foco programatico, nao o atributo autoFocus (jsx-a11y proibe) - seguro
  // aqui porque so se chega a este passo depois de uma escolha explicita
  // de teclado ou clique (mover para Delegar), nunca ao carregar a pagina.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="w-full max-w-sm space-y-3 text-center">
      <p className="text-[13px] text-text-muted">
        Delegar <span className="font-medium text-text">&ldquo;{taskTitle}&rdquo;</span> para quem?
      </p>

      <div className="flex items-center justify-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim() !== '') onPick(name.trim())
          }}
          list={listId}
          placeholder="Nome da pessoa"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />
        <datalist id={listId}>
          {peopleNames.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          disabled={name.trim() === ''}
          onClick={() => {
            onPick(name.trim())
          }}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-text-subtle underline-offset-2 hover:underline"
      >
        Pular
      </button>
    </div>
  )
}
