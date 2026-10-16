import { useSyncExternalStore } from 'react'
import { scriptCapabilityStore } from './engine.ts'

/** Compatibilidade com o script antigo (docs/prompt-anotacoes.md secao 1.6). */
export function useScriptCapability(): { readonly notesSupported: boolean } {
  return useSyncExternalStore(scriptCapabilityStore.subscribe, scriptCapabilityStore.get)
}
