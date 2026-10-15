import { useSyncExternalStore } from 'react'
import { syncStatusStore, type SyncStatus } from './engine.ts'

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.get)
}
