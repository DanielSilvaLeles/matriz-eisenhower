import { useSyncExternalStore } from 'react'
import { helpOpenStore } from './store.ts'

export function useHelpOpen(): boolean {
  return useSyncExternalStore(helpOpenStore.subscribe, helpOpenStore.get)
}
