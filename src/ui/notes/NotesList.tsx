import { ArrowUpDown, Download, NotebookPen, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNotes, useNoteTags } from '@/db/noteHooks.ts'
import { groupNotesByDay } from '@/domain/noteGrouping.ts'
import {
  filterNotes,
  hasActiveFilters,
  NO_FILTERS,
  type NoteFilters,
  type NotePeriodFilter,
} from '@/domain/noteSearch.ts'
import { buildNotesMarkdown } from '@/domain/notesMarkdown.ts'
import type { Note } from '@/domain/schema.ts'
import { useToday } from '@/ui/hooks/useNowTick.ts'
import { navigate } from '@/ui/router/store.ts'
import { cn } from '@/lib/utils.ts'
import { NoteListRow } from './NoteListRow.tsx'

/** "Exportar anotações em Markdown" (docs/prompt-anotacoes.md seção 7). */
function downloadNotesMarkdown(notes: readonly Note[]): void {
  const markdown = buildNotesMarkdown(notes)
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  try {
    const date = new Date().toISOString().slice(0, 10)
    const link = document.createElement('a')
    link.href = url
    link.download = `anotacoes-${date}.md`
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const PAGE_SIZE = 50

const PERIOD_OPTIONS: ReadonlyArray<{ readonly label: string; readonly period: NotePeriodFilter }> = [
  { label: 'Hoje', period: { kind: 'today' } },
  { label: '7 dias', period: { kind: 'last7' } },
  { label: '30 dias', period: { kind: 'last30' } },
]

function periodsEqual(a: NotePeriodFilter, b: NotePeriodFilter): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'range' && b.kind === 'range') return a.from === b.from && a.to === b.to
  return true
}

export interface NotesListProps {
  /** Id da anotação aberta agora (desktop: destaca a linha; mobile: sempre null, a lista some quando o editor abre). */
  selectedId: string | null
}

/**
 * Lista de anotações (`docs/prompt-anotacoes.md` seção 4): busca+filtros
 * instantâneos e locais, agrupada por dia, com paginação simples em vez de
 * virtualização (decisão registrada em `docs/DECISOES-ANOTACOES.md`, item
 * 3 - volume esperado de centenas por ano, não milhares).
 */
export function NotesList({ selectedId }: NotesListProps) {
  const allNotes = useNotes()
  const allTags = useNoteTags()
  const today = useToday()
  const [filters, setFilters] = useState<NoteFilters>(NO_FILTERS)
  const [reversed, setReversed] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => filterNotes(allNotes, filters, today), [allNotes, filters, today])
  const ordered = useMemo(() => (reversed ? filtered.toReversed() : filtered), [filtered, reversed])
  const page = useMemo(() => ordered.slice(0, visibleCount), [ordered, visibleCount])
  const groups = useMemo(() => groupNotesByDay(page, today), [page, today])
  const active = hasActiveFilters(filters)

  function clearFilters(): void {
    setFilters(NO_FILTERS)
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 className="text-[13px] font-semibold text-text">Anotações</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setReversed((prev) => !prev)
            }}
            aria-pressed={reversed}
            title={reversed ? 'Mais antiga primeiro' : 'Mais recente primeiro'}
            className="inline-flex size-7 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              downloadNotesMarkdown(allNotes)
            }}
            aria-label="Exportar anotações em Markdown"
            title="Exportar anotações em Markdown"
            className="inline-flex size-7 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ screen: 'note-editor', noteId: null })
            }}
            aria-label="Nova anotação"
            title="Nova anotação"
            className="inline-flex size-7 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
          >
            <NotebookPen className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 py-2">
        <input
          id="notes-search"
          type="search"
          value={filters.query}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, query: event.target.value }))
            setVisibleCount(PAGE_SIZE)
          }}
          placeholder="Buscar nas anotações…"
          autoComplete="off"
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-subtle focus-visible:border-focus"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = periodsEqual(filters.period, option.period)
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setFilters((prev) => ({
                    ...prev,
                    period: isActive ? { kind: 'all' } : option.period,
                  }))
                  setVisibleCount(PAGE_SIZE)
                }}
                aria-pressed={isActive}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px]',
                  isActive
                    ? 'border-focus bg-surface-muted font-medium text-text'
                    : 'border-border text-text-muted hover:bg-surface-muted',
                )}
              >
                {option.label}
              </button>
            )
          })}

          {allTags.length > 0 ? (
            <select
              value={filters.tag ?? ''}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, tag: event.target.value === '' ? null : event.target.value }))
                setVisibleCount(PAGE_SIZE)
              }}
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text"
            >
              <option value="">Todas as tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          ) : null}

          {active ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] text-text-subtle underline-offset-2 hover:underline"
            >
              <X className="size-3" aria-hidden="true" />
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {allNotes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-text">Nenhuma anotação ainda.</p>
            <p className="max-w-xs text-[12px] text-text-subtle">
              Uma <strong>ideia</strong> é uma linha rápida pra triar depois na caixa de entrada. Uma{' '}
              <strong>anotação</strong> é o texto de uma reunião ou conversa, pra consultar depois.
            </p>
            <button
              type="button"
              onClick={() => {
                navigate({ screen: 'note-editor', noteId: null })
              }}
              className="mt-1 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
            >
              Criar a primeira anotação
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-text-subtle">
            Nada encontrado com esses filtros.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.day}>
                <h3 className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                  {group.label}
                </h3>
                <ul className="space-y-0.5">
                  {group.notes.map((note) => (
                    <NoteListRow key={note.id} note={note} query={filters.query} active={note.id === selectedId} />
                  ))}
                </ul>
              </div>
            ))}

            {visibleCount < ordered.length ? (
              <button
                type="button"
                onClick={() => {
                  setVisibleCount((count) => count + PAGE_SIZE)
                }}
                className="mx-auto block rounded-md px-3 py-1.5 text-[12px] text-text-muted hover:bg-surface-muted"
              >
                Carregar mais ({ordered.length - visibleCount})
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
