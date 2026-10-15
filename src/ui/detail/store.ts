import { createStore } from '@/ui/store.ts'

/**
 * Id da tarefa aberta no painel de detalhe (docs secao 5.5), ou `null`
 * quando fechado. Store externo (nao useState local): o atalho global
 * `Enter` (useGlobalShortcuts.ts) e as linhas de tarefa de qualquer
 * quadrante precisam abrir o mesmo painel, sem ancestral React conveniente
 * em comum - mesmo padrao de src/ui/help/store.ts.
 */
export const selectedTaskIdStore = createStore<string | null>(null)
