/**
 * Liga `src/ui/router/route.ts` (puro) ao `window.location.hash` de
 * verdade - mesmo padrão `createStore` de `src/ui/store.ts`, já usado por
 * `selectedTaskIdStore`/`triageOpenStore`.
 */
import { createStore } from '@/ui/store.ts'
import { parseHash, routeToHash, type Route } from './route.ts'

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash
}

export const routeStore = createStore<Route>(parseHash(currentHash()))

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    routeStore.set(parseHash(window.location.hash))
  })
}

/** Navega trocando o hash - o listener de `hashchange` acima atualiza o store sozinho. */
export function navigate(route: Route): void {
  if (typeof window === 'undefined') return
  window.location.hash = routeToHash(route)
}
