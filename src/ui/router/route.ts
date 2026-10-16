/**
 * Roteamento por hash (`docs/prompt-anotacoes.md` seção 3.3): o site é
 * estático no GitHub Pages, sem servidor - hash (`#/anotacoes/ID`) é o
 * único jeito de link direto e recarregar a página funcionarem no
 * subcaminho do repositório e no PWA instalado, sem precisar de nenhuma
 * configuração de servidor (que não existe).
 *
 * Pura: string para dentro, string para fora - `src/ui/router/store.ts` é
 * quem liga isso ao `window.location.hash` de verdade.
 */

export type Route =
  | { readonly screen: 'matrix' }
  | { readonly screen: 'notes-list' }
  | { readonly screen: 'note-editor'; readonly noteId: string | null }

const NOTE_EDITOR_PATTERN = /^\/anotacoes\/([^/]+)$/u

/**
 * `#/` ou vazio → Matriz (home); `#/anotacoes` → lista; `#/anotacoes/ID` →
 * editor de uma anotação existente; `#/anotacoes/nova` → editor em branco
 * (`noteId: null`, a anotação só passa a existir quando o corpo deixa de
 * ser vazio - ver `src/domain/note.ts`). Qualquer outra coisa cai na
 * Matriz, nunca numa tela de erro - um link quebrado não pode travar o app.
 */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/u, '')
  if (path === '' || path === '/') return { screen: 'matrix' }
  if (path === '/anotacoes') return { screen: 'notes-list' }

  const match = NOTE_EDITOR_PATTERN.exec(path)
  if (match) {
    const id = match[1] ?? ''
    return { screen: 'note-editor', noteId: id === 'nova' ? null : id }
  }

  return { screen: 'matrix' }
}

export function routeToHash(route: Route): string {
  if (route.screen === 'matrix') return '#/'
  if (route.screen === 'notes-list') return '#/anotacoes'
  return `#/anotacoes/${route.noteId ?? 'nova'}`
}
