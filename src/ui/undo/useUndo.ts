import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, type UndoAction } from './store.ts'

/** A acao desfazivel pendente agora, ou `null` se nenhuma. */
export function usePendingUndo(): UndoAction | null {
  return useSyncExternalStore(subscribe, getSnapshot)
}
