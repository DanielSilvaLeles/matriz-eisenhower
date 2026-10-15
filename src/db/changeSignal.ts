/**
 * Sinal generico "algo mudou localmente", emitido por toda mutacao do
 * repositorio. `src/db` nao sabe que `src/sync` existe - quem ouve
 * (`src/sync/triggers.ts`) e que decide o que fazer com o aviso (agendar o
 * debounce de 3s, docs secao 6.1). Mantem a dependencia numa direcao so:
 * sync conhece db, db nunca conhece sync.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function notifyLocalWrite(): void {
  for (const listener of listeners) listener()
}

export function onLocalWrite(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
