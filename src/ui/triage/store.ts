import { createStore } from '@/ui/store.ts'

/**
 * Modo triagem (docs secao 5.3) aberto ou fechado. Store externo, nao
 * useState local: dois gatilhos sem ancestral React em comum precisam
 * abrir o mesmo overlay - o botão "Triar agora" (dentro da caixa de
 * entrada) e o atalho global `T` (useGlobalShortcuts.ts) - mesmo padrão de
 * src/ui/help/store.ts.
 */
export const triageOpenStore = createStore(false)
