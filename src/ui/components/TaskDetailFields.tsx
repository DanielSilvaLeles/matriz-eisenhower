import { NotebookPen } from 'lucide-react'
import { useId, useState } from 'react'
import { getDB } from '@/db/schema.ts'
import { editTaskFields } from '@/db/tasksRepo.lifecycle.ts'
import { quadrantMeta } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { selectedTaskIdStore } from '@/ui/detail/store.ts'
import { useDebouncedCallback } from '@/ui/hooks/useDebouncedCallback.ts'
import { navigate } from '@/ui/router/store.ts'

/** Pausa de digitação antes do autosave entrar em ação (ver useDebouncedCallback.ts). */
const AUTOSAVE_DELAY_MS = 1_500

export interface TaskDetailFieldsProps {
  task: Task
  peopleNames: readonly string[]
}

function parseTags(text: string): readonly string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of text.split(',')) {
    const tag = raw.trim().toLowerCase()
    if (tag !== '' && !seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}

/**
 * Campos editaveis do painel de detalhe (docs secao 5.5): "salva sozinho ao
 * editar" - um `onBlur` por campo de texto salva na hora de sair do campo,
 * mais um autosave debounced (`AUTOSAVE_DELAY_MS` de pausa) que salva
 * sozinho mesmo sem a pessoa sair do campo. Data e troca de quadrante
 * salvam direto no `onChange`, por serem escolhas de uma tecla só, não
 * digitação contínua.
 *
 * **O autosave debounced existe por causa de um relato real de perda de
 * texto**: só `onBlur` (a decisão original desta tela) supõe que a pessoa
 * sempre sai do campo de propósito - mas uma interrupção fora do controle
 * dela (trocar de app no celular e o navegador reclamar a aba em segundo
 * plano, por exemplo) também encerra a edição sem nunca disparar o
 * `onBlur`. Ver `useDebouncedCallback.ts` para o raciocínio completo.
 *
 * Recebe `key={task.id}` do componente pai (TaskDetailPanel): trocar de
 * tarefa remonta este componente do zero, com o estado local reiniciado a
 * partir da tarefa nova - mais simples e mais correto do que um `useEffect`
 * sincronizando estado a cada troca.
 */
export function TaskDetailFields({ task, peopleNames }: TaskDetailFieldsProps) {
  const db = getDB()
  const dateLabel = task.quadrant === null ? null : quadrantMeta(task.quadrant).dateLabel
  const peopleListId = useId()

  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [delegatedTo, setDelegatedTo] = useState(task.delegated_to ?? '')
  const [delegationContext, setDelegationContext] = useState(task.delegation_context ?? '')
  const [expectedOutcome, setExpectedOutcome] = useState(task.expected_outcome ?? '')
  const [tagsText, setTagsText] = useState(task.tags.join(', '))

  function save(edits: Parameters<typeof editTaskFields>[2]) {
    editTaskFields(db, task.id, edits).catch((error: unknown) => {
      console.error('Falha ao salvar a tarefa', error)
    })
  }

  const titleAutosave = useDebouncedCallback((value: string) => {
    if (value.trim() !== task.title) save({ title: value })
  }, AUTOSAVE_DELAY_MS)
  const notesAutosave = useDebouncedCallback((value: string) => {
    const next = value.trim() === '' ? null : value
    if (next !== task.notes) save({ notes: next })
  }, AUTOSAVE_DELAY_MS)
  const delegatedToAutosave = useDebouncedCallback((value: string) => {
    const next = value.trim() === '' ? null : value.trim()
    if (next !== task.delegated_to) save({ delegated_to: next })
  }, AUTOSAVE_DELAY_MS)
  const delegationContextAutosave = useDebouncedCallback((value: string) => {
    const next = value.trim() === '' ? null : value
    if (next !== task.delegation_context) save({ delegation_context: next })
  }, AUTOSAVE_DELAY_MS)
  const expectedOutcomeAutosave = useDebouncedCallback((value: string) => {
    const next = value.trim() === '' ? null : value
    if (next !== task.expected_outcome) save({ expected_outcome: next })
  }, AUTOSAVE_DELAY_MS)
  const tagsAutosave = useDebouncedCallback((value: string) => {
    const next = parseTags(value)
    if (next.join(',') !== task.tags.join(',')) save({ tags: next })
  }, AUTOSAVE_DELAY_MS)

  const titleId = useId()
  const notesId = useId()
  const dateId = useId()
  const delegatedToId = useId()
  const contextId = useId()
  const outcomeId = useId()
  const tagsId = useId()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      {task.source_note_id === null ? null : (
        <button
          type="button"
          onClick={() => {
            const noteId = task.source_note_id
            if (noteId === null) return
            selectedTaskIdStore.set(null)
            navigate({ screen: 'note-editor', noteId })
          }}
          className="inline-flex w-fit items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <NotebookPen className="size-3.5" aria-hidden="true" />
          Ver anotação de origem
        </button>
      )}

      <div>
        <label htmlFor={titleId} className="sr-only">
          Título
        </label>
        <input
          id={titleId}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            titleAutosave.run(event.target.value)
          }}
          onBlur={() => {
            titleAutosave.cancel()
            if (title.trim() !== task.title) save({ title })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[15px] font-semibold text-text focus-visible:border-focus"
        />
      </div>

      {dateLabel === null ? null : (
        <div>
          <label htmlFor={dateId} className="mb-1 block text-xs text-text-muted">
            {dateLabel}
          </label>
          <input
            id={dateId}
            type="date"
            value={task.date ?? ''}
            onChange={(event) => {
              save({ date: event.target.value === '' ? null : event.target.value })
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
          />
        </div>
      )}

      <div>
        <label htmlFor={notesId} className="mb-1 block text-xs text-text-muted">
          Notas
        </label>
        <textarea
          id={notesId}
          rows={3}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value)
            notesAutosave.run(event.target.value)
          }}
          onBlur={() => {
            notesAutosave.cancel()
            const next = notes.trim() === '' ? null : notes
            if (next !== task.notes) save({ notes: next })
          }}
          className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />
      </div>

      <div className="border-t border-border pt-3">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
          Delegação
        </h3>

        <label htmlFor={delegatedToId} className="mb-1 block text-xs text-text-muted">
          Para quem?
        </label>
        <input
          id={delegatedToId}
          type="text"
          list={peopleListId}
          value={delegatedTo}
          onChange={(event) => {
            setDelegatedTo(event.target.value)
            delegatedToAutosave.run(event.target.value)
          }}
          onBlur={() => {
            delegatedToAutosave.cancel()
            const next = delegatedTo.trim() === '' ? null : delegatedTo.trim()
            if (next !== task.delegated_to) save({ delegated_to: next })
          }}
          placeholder="Nome da pessoa"
          className="mb-2 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />
        <datalist id={peopleListId}>
          {peopleNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </datalist>

        <label htmlFor={contextId} className="mb-1 block text-xs text-text-muted">
          Por que é urgente
        </label>
        <textarea
          id={contextId}
          rows={2}
          value={delegationContext}
          onChange={(event) => {
            setDelegationContext(event.target.value)
            delegationContextAutosave.run(event.target.value)
          }}
          onBlur={() => {
            delegationContextAutosave.cancel()
            const next = delegationContext.trim() === '' ? null : delegationContext
            if (next !== task.delegation_context) save({ delegation_context: next })
          }}
          className="mb-2 w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />

        <label htmlFor={outcomeId} className="mb-1 block text-xs text-text-muted">
          Resultado esperado
        </label>
        <textarea
          id={outcomeId}
          rows={2}
          value={expectedOutcome}
          onChange={(event) => {
            setExpectedOutcome(event.target.value)
            expectedOutcomeAutosave.run(event.target.value)
          }}
          onBlur={() => {
            expectedOutcomeAutosave.cancel()
            const next = expectedOutcome.trim() === '' ? null : expectedOutcome
            if (next !== task.expected_outcome) save({ expected_outcome: next })
          }}
          className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />
      </div>

      <div>
        <label htmlFor={tagsId} className="mb-1 block text-xs text-text-muted">
          Tags (separadas por vírgula)
        </label>
        <input
          id={tagsId}
          type="text"
          value={tagsText}
          onChange={(event) => {
            setTagsText(event.target.value)
            tagsAutosave.run(event.target.value)
          }}
          onBlur={() => {
            tagsAutosave.cancel()
            const next = parseTags(tagsText)
            if (next.join(',') !== task.tags.join(',')) save({ tags: next })
          }}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
        />
      </div>
    </div>
  )
}
