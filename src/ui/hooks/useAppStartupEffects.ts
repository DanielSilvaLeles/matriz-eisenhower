import { useEffect } from 'react'
import { archiveStaleQ4Tasks } from '@/db/archiveQ4.ts'
import { getDB } from '@/db/schema.ts'
import { setupSyncTriggers } from '@/sync/triggers.ts'
import { useIncomingIntent } from '@/pwa/useIncomingIntent.ts'

/**
 * Tudo que só precisa rodar uma vez, ao montar o app - agrupado aqui so
 * para `App.tsx` não estourar o limite de imports do lint (mesmo motivo de
 * `AppHeaderActions.tsx`/`GlobalOverlays.tsx`).
 */
export function useAppStartupEffects(): void {
  useEffect(() => {
    // Pede para o navegador nao limpar o banco local por pressao de espaco
    // (docs secao 6.3). So pedido, nunca garantido: se o navegador recusar
    // ou nao suportar, o app segue normalmente - best-effort e silencioso.
    try {
      navigator.storage.persist().catch(() => {
        // Recusado pelo navegador: nada a fazer, so seguir sem a garantia.
      })
    } catch {
      // API nao suportada neste navegador.
    }
  }, [])

  // Liga os gatilhos automaticos de sync (docs secao 6.1): ao abrir, ao
  // focar, a cada 60s visivel, 3s apos editar, ao voltar a conexao.
  useEffect(() => setupSyncTriggers(), [])

  // Arquivamento automatico do Q4 na virada do dia (docs secao 5.4): roda
  // uma vez ao abrir o app - suficiente, nao precisa ser no instante exato
  // da meia-noite (ver src/db/archiveQ4.ts).
  useEffect(() => {
    archiveStaleQ4Tasks(getDB(), new Date().toISOString()).catch((error: unknown) => {
      console.error('Falha ao arquivar tarefas de Eliminar', error)
    })
  }, [])

  // Share target e atalho "Nova anotação" (docs secao 8).
  useIncomingIntent()
}
