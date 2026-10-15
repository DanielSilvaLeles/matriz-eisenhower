/**
 * Quando sincronizar (docs secao 6.1): ao abrir o app, ao voltar o foco
 * para a aba, a cada 60s com o app visivel, 3s depois da ultima edicao
 * (debounce), ao voltar a conexao, e ao clicar em "Sincronizar agora"
 * (pula o debounce e o intervalo - essa chamada e feita direto via
 * `runSync()`, nao por aqui).
 *
 * `onLocalWrite` (src/db/changeSignal.ts) e quem avisa "algo mudou" sem o
 * banco precisar saber que a sincronizacao existe.
 */
import { onLocalWrite } from '@/db/changeSignal.ts'
import { runSync } from './engine.ts'

const INTERVAL_MS = 60_000
const DEBOUNCE_MS = 3_000

function fireAndForget(): void {
  runSync().catch((error: unknown) => {
    console.error('Falha num ciclo de sincronizacao', error)
  })
}

/** Liga os gatilhos automaticos. Devolve uma funcao para desligar tudo (teste/HMR). */
export function setupSyncTriggers(): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function handleLocalWrite(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      fireAndForget()
    }, DEBOUNCE_MS)
  }

  function handleVisible(): void {
    if (document.visibilityState === 'visible') fireAndForget()
  }

  // Ao abrir.
  fireAndForget()

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') fireAndForget()
  }, INTERVAL_MS)

  document.addEventListener('visibilitychange', handleVisible)
  window.addEventListener('focus', fireAndForget)
  window.addEventListener('online', fireAndForget)
  const stopListeningToWrites = onLocalWrite(handleLocalWrite)

  return () => {
    clearInterval(intervalId)
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    document.removeEventListener('visibilitychange', handleVisible)
    window.removeEventListener('focus', fireAndForget)
    window.removeEventListener('online', fireAndForget)
    stopListeningToWrites()
  }
}
