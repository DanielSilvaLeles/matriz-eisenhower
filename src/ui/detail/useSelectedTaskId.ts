import { useSyncExternalStore } from 'react'
import { selectedTaskIdStore } from './store.ts'

export function useSelectedTaskId(): string | null {
  return useSyncExternalStore(selectedTaskIdStore.subscribe, selectedTaskIdStore.get)
}
