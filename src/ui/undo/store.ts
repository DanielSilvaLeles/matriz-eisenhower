/**
 * Pilha de desfazer de um nivel: a ultima acao desfazivel, exibida por um
 * toast com "Desfazer" por alguns segundos (docs secao 4.4). Nao ha
 * modal de confirmacao em lugar nenhum do app - isto e o que existe no lugar.
 *
 * Um nivel so, nao uma pilha profunda: e a mesma leitura do atalho global
 * `Ctrl+Z` (docs secao 5.6) - desfaz a ultima acao, nao uma sequencia.
 * Store externo (nao um hook) porque teclado, menu e drag-and-drop
 * precisam chamar `pushUndo`/`undoPending` de fora de componentes React.
 */

export interface UndoAction {
  readonly id: string
  /** Texto do toast, ex.: "Movida para Agendar." */
  readonly message: string
  readonly undo: () => Promise<void> | void
}

type Listener = () => void

const TOAST_DURATION_MS = 6000

let current: UndoAction | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function clearPending(): void {
  current = null
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  notify()
}

/** Registra uma acao desfazivel. Substitui a pendente e reinicia os 6s. */
export function pushUndo(action: UndoAction): void {
  if (timer !== null) clearTimeout(timer)
  current = action
  timer = setTimeout(clearPending, TOAST_DURATION_MS)
  notify()
}

/** Desfaz a acao pendente, se houver - clique no toast ou `Ctrl+Z`. */
export async function undoPending(): Promise<void> {
  const action = current
  if (!action) return
  clearPending()
  await action.undo()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): UndoAction | null {
  return current
}
