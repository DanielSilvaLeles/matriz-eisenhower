/**
 * Fabrica minima de store externo (padrao observable via useSyncExternalStore),
 * para estado compartilhado entre componentes sem ancestral comum
 * conveniente - como o painel de ajuda, aberto por um atalho de teclado
 * global que nao tem (nem deveria ter) acesso ao estado local de um
 * componente React especifico.
 */
export interface Store<T> {
  readonly get: () => T
  readonly set: (value: T) => void
  readonly subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (value: T) => {
      state = value
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
