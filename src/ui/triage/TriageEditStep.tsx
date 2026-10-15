import { useEffect, useRef, useState } from 'react'

export interface TriageEditStepProps {
  initialTitle: string
  onSave: (title: string) => void
}

/** Tecla `E` na triagem (docs secao 5.3): edita o titulo do item atual. */
export function TriageEditStep({ initialTitle, onSave }: TriageEditStepProps) {
  const [value, setValue] = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foco programatico (nao o atributo autoFocus, que o jsx-a11y proibe por
  // tirar o controle de quem navega por teclado) - aqui e seguro porque a
  // tecla que abriu este passo (E) ja era, ela mesma, um atalho de teclado.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="w-full max-w-sm space-y-3 text-center">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSave(value)
        }}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-center text-[15px] text-text focus-visible:border-focus"
      />
      <button
        type="button"
        onClick={() => {
          onSave(value)
        }}
        className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
      >
        Salvar
      </button>
    </div>
  )
}
