import { useSyncExternalStore } from 'react'
import type { Route } from './route.ts'
import { routeStore } from './store.ts'

export function useRoute(): Route {
  return useSyncExternalStore(routeStore.subscribe, routeStore.get)
}
