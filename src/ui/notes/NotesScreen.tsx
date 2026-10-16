import { useMediaQuery } from '@/ui/hooks/useMediaQuery.ts'
import { useRoute } from '@/ui/router/useRoute.ts'
import { NoteEditor } from './NoteEditor.tsx'
import { NotesList } from './NotesList.tsx'

/** Mesmo valor do breakpoint `sm` do Tailwind, igual ao resto do app (ver App.tsx). */
const DESKTOP_QUERY = '(min-width: 40rem)'

/**
 * Tela de anotações (`docs/prompt-anotacoes.md` seção 4): desktop em dois
 * painéis (lista + anotação aberta lado a lado); celular, lista OU editor
 * em tela cheia, nunca os dois - a rota decide qual.
 */
export function NotesScreen() {
  const route = useRoute()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const selectedId = route.screen === 'note-editor' ? route.noteId : undefined

  if (isDesktop) {
    return (
      <main className="flex min-h-0 flex-1 gap-3 sm:gap-4">
        <div className="flex min-h-0 w-full max-w-sm flex-col rounded-lg border border-border bg-surface">
          <NotesList selectedId={selectedId ?? null} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface">
          {selectedId === undefined ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-text-subtle">
              Selecione uma anotação à esquerda, ou crie uma nova (atalho <kbd>A</kbd>).
            </div>
          ) : (
            <NoteEditor noteId={selectedId} />
          )}
        </div>
      </main>
    )
  }

  if (route.screen === 'note-editor') {
    return <NoteEditor noteId={route.noteId} showTopBar />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-14">
      <NotesList selectedId={null} />
    </div>
  )
}
