import { Plus } from 'lucide-react'
import { useId, useState, type SubmitEvent } from 'react'

export interface AddTaskFieldProps {
  /** Usado so no rotulo acessivel - "Adicionar tarefa em Fazer". */
  quadrantVerb: string
  onAdd: (title: string) => Promise<unknown>
}

/**
 * Campo sempre visivel por quadrante (docs secao 5.1). Enter adiciona e
 * mantem o foco para a proxima - por isso nunca chamamos blur() nem
 * desmontamos o input: so limpamos o valor apos salvar.
 */
export function AddTaskField({ quadrantVerb, onAdd }: AddTaskFieldProps) {
  const id = useId()
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = value.trim()
    if (title === '') return

    // Limpa ANTES de aguardar a gravacao, nao depois: addTaskToQuadrant e
    // assincrono (e uma transacao Dexie), e so limpar quando ela resolver
    // deixa uma janela em que a proxima tecla digitada cai no texto antigo
    // em vez de comecar do zero - "mantem o foco para a proxima" exige o
    // campo pronto na hora, nao so depois que o banco responder.
    setValue('')
    setFailed(false)
    try {
      await onAdd(title)
    } catch {
      // Devolve o texto para a pessoa nao perder a captura ao tentar de novo.
      setFailed(true)
      setValue(title)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        Adicionar tarefa em {quadrantVerb}
      </label>
      <Plus className="size-3.5 shrink-0 text-text-subtle" aria-hidden="true" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
        }}
        placeholder="Adicionar tarefa"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-text placeholder:text-text-subtle focus:outline-none"
      />
      {failed ? (
        <span className="shrink-0 text-xs text-q4-ink" role="alert">
          Não salvou. Tente de novo.
        </span>
      ) : null}
    </form>
  )
}
