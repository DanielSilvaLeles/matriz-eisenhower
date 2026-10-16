import { highlightSegments } from '@/domain/noteSearch.ts'
import type { Note } from '@/domain/schema.ts'
import { navigate } from '@/ui/router/store.ts'
import { cn } from '@/lib/utils.ts'

function Highlighted({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query)
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          // eslint-disable-next-line react/no-array-index-key -- segmentos sao derivados, sem id proprio; a lista inteira troca junto com o texto/busca.
          <mark key={index} className="rounded-sm bg-warn-soft text-warn">
            {segment.text}
          </mark>
        ) : (
          // eslint-disable-next-line react/no-array-index-key -- ver comentario acima.
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

function previewOf(body: string): string {
  return body.split(/\r\n|\r|\n/u).slice(0, 2).join(' ').slice(0, 180)
}

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEditedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export interface NoteListRowProps {
  note: Note
  query: string
  active: boolean
}

/** Linha da lista de anotações (`docs/prompt-anotacoes.md` seção 4): título ou 1ª linha, prévia, tags, data/hora de inclusão. */
export function NoteListRow({ note, query, active }: NoteListRowProps) {
  const titleText = note.title ?? note.body.split(/\r\n|\r|\n/u)[0] ?? ''
  const edited = note.updated_at !== note.created_at

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          navigate({ screen: 'note-editor', noteId: note.id })
        }}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left',
          active ? 'bg-surface-muted' : 'hover:bg-surface-muted',
        )}
      >
        <p className="truncate text-[13px] font-medium text-text">
          <Highlighted text={titleText} query={query} />
        </p>
        <p className="line-clamp-2 text-[12px] text-text-muted">
          <Highlighted text={previewOf(note.body)} query={query} />
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-subtle">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-sunken px-1.5">
              #{tag}
            </span>
          ))}
          <span className="tabular-nums">{formatCreated(note.created_at)}</span>
          {edited ? <span>editada {formatEditedTime(note.updated_at)}</span> : null}
        </div>
      </button>
    </li>
  )
}
