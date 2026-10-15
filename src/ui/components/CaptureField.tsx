import { useState, type ClipboardEvent, type SubmitEvent } from 'react'
import { captureItem } from '@/capture.ts'
import { getDB } from '@/db/schema.ts'
import { discardTask } from '@/db/tasksRepo.ts'
import { pushUndo } from '@/ui/undo/store.ts'

/** Id estavel: o atalho global `N` foca este campo de qualquer lugar (docs secao 5.2). */
export const INBOX_CAPTURE_FIELD_ID = 'inbox-capture'

/**
 * Campo de captura da caixa de entrada. Colar de uma vez um texto com
 * quebra de linha vira varios itens (um por linha) com opcao de desfazer em
 * lote; digitar e dar Enter normalmente cria um item so, sem toast - mesma
 * leitura do campo "Adicionar tarefa" dos quadrantes.
 */
export function CaptureField() {
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  async function submitText(text: string, announceBatch: boolean) {
    const trimmed = text.trim()
    if (trimmed === '') return

    setValue('')
    setFailed(false)
    try {
      const created = await captureItem({ text: trimmed, source: 'web' })
      if (announceBatch && created.length > 1) {
        const db = getDB()
        pushUndo({
          id: created[0]?.id ?? crypto.randomUUID(),
          message: `${created.length} itens adicionados à caixa de entrada.`,
          undo: async () => {
            for (const task of created) {
              // eslint-disable-next-line no-await-in-loop -- sequencial de proposito, ver src/capture.ts.
              await discardTask(db, task.id)
            }
          },
        })
      }
    } catch {
      setFailed(true)
      setValue(text)
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitText(value, false)
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text')
    // Uma linha so: deixa o navegador colar normalmente no campo. So texto
    // com quebra de linha e "colar de uma vez" no sentido do documento.
    if (!pasted.includes('\n')) return

    event.preventDefault()
    submitText(pasted, true).catch((error: unknown) => {
      console.error('Falha ao capturar texto colado', error)
    })
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex items-center gap-2 px-3 py-2.5"
    >
      <input
        id={INBOX_CAPTURE_FIELD_ID}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
        }}
        onPaste={handlePaste}
        placeholder="Capturar uma ideia…"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus-visible:border-focus"
      />
      {failed ? (
        <span role="alert" className="shrink-0 text-xs text-q4-ink">
          Não salvou.
        </span>
      ) : null}
    </form>
  )
}
