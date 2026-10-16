import { useSyncExternalStore } from 'react'
import { payloadWarningStore } from './engine.ts'

/** Aviso previo de payload grande (docs/prompt-anotacoes.md secao 6.3). */
export function usePayloadWarning(): boolean {
  return useSyncExternalStore(payloadWarningStore.subscribe, payloadWarningStore.get)
}
