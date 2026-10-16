import { ArrowRight, Clock } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { discardEmptyNote } from '@/db/notesRepo.lifecycle.ts'
import { sendActionLineToInbox } from '@/db/notesRepo.actionLines.ts'
import { createNoteWithContent, editNoteFields } from '@/db/notesRepo.ts'
import { getDeviceName } from '@/db/device.ts'
import { getDB } from '@/db/schema.ts'
import { extractActionLines, markActionLineSent } from '@/domain/actionLines.ts'
import { continuationPrefixFor } from '@/domain/note.ts'
import type { Note } from '@/domain/schema.ts'
import { useDebouncedCallback } from '@/ui/hooks/useDebouncedCallback.ts'

/** Pausa de digitação antes do autosave (`docs/prompt-anotacoes.md` seção 5: "debounce curto, cerca de 500 ms"). */
const AUTOSAVE_DELAY_MS = 500

export interface NoteEditorFormProps {
  /** `null` = compose de uma anotação nova; o id ainda não existe no banco até o primeiro caractere. */
  note: Note | null
  /** Id já reservado para esta sessão de compose (gerado uma vez no componente pai, estável enquanto não navega). */
  composeId?: string
}

type SaveState = 'idle' | 'saving' | 'saved'

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
): { readonly value: string; readonly cursor: number } {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value.slice(0, start) + text + textarea.value.slice(end)
  return { value, cursor: start + text.length }
}

/**
 * Formulário de verdade - sempre montado com `key` estável por anotação
 * (ver `NoteEditor.tsx`), para o estado local nascer uma vez só a partir
 * de um objeto `Note` já em mãos, nunca de uma releitura assíncrona (mesma
 * lição do bug real documentado em `TriageOverlay` - ver CLAUDE.md).
 */
export function NoteEditorForm({ note, composeId }: NoteEditorFormProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Id reservado para esta sessão: existente (edição) ou recém-gerado
  // (compose) - nunca muda durante a vida deste componente.
  const idRef = useRef(note?.id ?? composeId ?? crypto.randomUUID())
  const createdRef = useRef(note !== null)
  const isComposeSession = note === null

  function persist(nextTitle: string, nextBody: string): Promise<void> {
    const db = getDB()
    const device = getDeviceName()
    const trimmedTitle = nextTitle.trim() === '' ? null : nextTitle.trim()

    if (!createdRef.current) {
      // Ainda não existe no banco - nada a fazer enquanto o corpo for vazio.
      if (nextBody.trim() === '') return Promise.resolve()
      createdRef.current = true
      setSaveState('saving')
      return createNoteWithContent(db, idRef.current, nextBody, trimmedTitle, device)
        .then(() => {
          setSaveState('saved')
        })
        .catch((error: unknown) => {
          console.error('Falha ao criar a anotação', error)
        })
    }

    setSaveState('saving')
    return editNoteFields(db, idRef.current, { title: trimmedTitle, body: nextBody }, device)
      .then(() => {
        setSaveState('saved')
      })
      .catch((error: unknown) => {
        console.error('Falha ao salvar a anotação', error)
      })
  }

  const autosave = useDebouncedCallback((nextTitle: string, nextBody: string) => {
    void persist(nextTitle, nextBody)
  }, AUTOSAVE_DELAY_MS)

  /**
   * Salvamento imediato (seção 5: "em blur, visibilitychange e pagehide,
   * nunca pode haver perda de texto digitado") - cancela o debounce
   * pendente e grava na hora, ou descarta em silêncio se a anotação de
   * compose nunca ganhou conteúdo.
   */
  function flush(currentTitle: string, currentBody: string): Promise<void> {
    autosave.cancel()
    if (currentBody.trim() === '') {
      if (isComposeSession && createdRef.current) {
        createdRef.current = false
        return discardEmptyNote(getDB(), idRef.current).catch((error: unknown) => {
          console.error('Falha ao descartar anotação vazia', error)
        })
      }
      return Promise.resolve()
    }
    return persist(currentTitle, currentBody)
  }

  /**
   * "De anotação para tarefa" (`docs/prompt-anotacoes.md` seção 5.1): envia
   * o texto da linha para a caixa de entrada e troca o marcador por `[→]`.
   * Dá `flush` ANTES de chamar `sendActionLineToInbox` - essa função lê o
   * corpo já persistido no banco para decidir o que mudar; sem esperar um
   * autosave pendente terminar primeiro, ela poderia ler uma versão
   * desatualizada e a resposta (marcador trocado) não bater com o que a
   * tela está mostrando.
   */
  function handleSendLine(lineIndex: number): void {
    if (!createdRef.current) return
    flush(title, body)
      .then(() => sendActionLineToInbox(getDB(), idRef.current, lineIndex))
      .then(() => {
        setBody((current) => markActionLineSent(current, lineIndex))
      })
      .catch((error: unknown) => {
        console.error('Falha ao enviar linha de ação para a caixa de entrada', error)
      })
  }

  useEffect(() => {
    function handleVisibility(): void {
      if (document.visibilityState === 'hidden') {
        flush(title, body).catch((error: unknown) => {
          console.error('Falha ao salvar a anotação ao sair da aba', error)
        })
      }
    }
    function handlePageHide(): void {
      flush(title, body).catch((error: unknown) => {
        console.error('Falha ao salvar a anotação ao fechar a página', error)
      })
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- title/body lidos via closure fresca a cada render, listeners recriados junto (ver corpo da funcao).
  }, [title, body])

  function handleBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    const textarea = event.currentTarget

    // Ctrl+; "Inserir hora" (seção 5): escreve [HH:MM] na posição do cursor.
    if ((event.ctrlKey || event.metaKey) && event.key === ';') {
      event.preventDefault()
      const stamp = `[${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] `
      const { value, cursor } = insertAtCursor(textarea, stamp)
      setBody(value)
      autosave.run(title, value)
      requestAnimationFrame(() => {
        textarea.setSelectionRange(cursor, cursor)
      })
      return
    }

    // Enter numa linha "- " ou "[ ] " continua o marcador (seção 5).
    if (event.key === 'Enter') {
      const cursor = textarea.selectionStart
      const lineStart = textarea.value.lastIndexOf('\n', cursor - 1) + 1
      const currentLine = textarea.value.slice(lineStart, cursor)
      const prefix = continuationPrefixFor(currentLine)
      if (prefix !== null) {
        event.preventDefault()
        const { value, cursor: nextCursor } = insertAtCursor(textarea, `\n${prefix}`)
        setBody(value)
        autosave.run(title, value)
        requestAnimationFrame(() => {
          textarea.setSelectionRange(nextCursor, nextCursor)
        })
      }
    }
  }

  const statusLabel = saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo' : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-subtle">
          {note === null ? (
            'Nova anotação'
          ) : (
            <>Incluída em {new Date(note.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
        {statusLabel === null ? null : (
          <output className="text-[11px] text-text-subtle">{statusLabel}</output>
        )}
      </div>

      <input
        type="text"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
          autosave.run(event.target.value, body)
        }}
        onBlur={() => {
          flush(title, body).catch((error: unknown) => {
            console.error('Falha ao salvar a anotação', error)
          })
        }}
        placeholder="Título (opcional)"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[15px] font-semibold text-text placeholder:text-text-subtle focus-visible:border-focus"
      />

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
          autosave.run(title, event.target.value)
        }}
        onKeyDown={handleBodyKeyDown}
        onBlur={() => {
          flush(title, body).catch((error: unknown) => {
            console.error('Falha ao salvar a anotação', error)
          })
        }}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- so chega aqui apos a pessoa escolher "Anotar" de proposito (docs secao 11: "em ate 2s o cursor esta no editor").
        autoFocus
        placeholder="Comece a digitar…"
        className="min-h-40 w-full flex-1 resize-none rounded-md border border-border bg-surface px-2.5 py-2 text-[14px] leading-relaxed text-text placeholder:text-text-subtle focus-visible:border-focus"
      />

      <button
        type="button"
        onClick={() => {
          const textarea = bodyRef.current
          if (!textarea) return
          const stamp = `[${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] `
          const { value, cursor } = insertAtCursor(textarea, stamp)
          setBody(value)
          autosave.run(title, value)
          textarea.focus()
          requestAnimationFrame(() => {
            textarea.setSelectionRange(cursor, cursor)
          })
        }}
        title="Inserir hora (Ctrl+;)"
        className="inline-flex w-fit items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-muted hover:bg-surface-muted"
      >
        <Clock className="size-3.5" aria-hidden="true" />
        Inserir hora
      </button>

      {createdRef.current ? <ActionLinesSection body={body} onSend={handleSendLine} /> : null}
    </div>
  )
}

/**
 * Lista as linhas `[ ]`/`- [ ] ` pendentes de envio (`docs/prompt-anotacoes.md`
 * seção 5.1) com o botão "→ Caixa de entrada" por linha. Só para anotações
 * já existentes - durante o compose (`note === null`) o id ainda não
 * necessariamente está gravado no banco, e `sendActionLineToInbox` precisa
 * ler a anotação de lá.
 */
function ActionLinesSection({ body, onSend }: { body: string; onSend: (lineIndex: number) => void }) {
  const pending = extractActionLines(body).filter((line) => !line.sent && line.text !== '')
  if (pending.length === 0) return null

  return (
    <div className="border-t border-border pt-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
        Itens de ação
      </h3>
      <ul className="space-y-1.5">
        {pending.map((line) => (
          <li key={line.lineIndex} className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-text">{line.text}</span>
            <button
              type="button"
              onClick={() => {
                onSend(line.lineIndex)
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <ArrowRight className="size-3" aria-hidden="true" />
              Caixa de entrada
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
