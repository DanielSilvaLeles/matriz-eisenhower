import { useEffect } from 'react'
import { usePendingCount } from '@/db/hooks.ts'
import { setupSyncTriggers } from '@/sync/triggers.ts'
import { DndWorkspace } from '@/ui/dnd/DndWorkspace.tsx'
import { useGlobalShortcuts } from '@/ui/shortcuts/useGlobalShortcuts.ts'
import { useMediaQuery } from '@/ui/hooks/useMediaQuery.ts'
import { useWarnBeforeUnload } from '@/ui/hooks/useWarnBeforeUnload.ts'
import { HelpOverlay } from '@/ui/components/HelpOverlay.tsx'
import { InboxPanel } from '@/ui/components/InboxPanel.tsx'
import { MatrixGrid } from '@/ui/components/MatrixGrid.tsx'
import { MobileMatrixView } from '@/ui/components/MobileMatrixView.tsx'
import { SettingsPanel } from '@/ui/components/SettingsPanel.tsx'
import { SyncIndicator } from '@/ui/components/SyncIndicator.tsx'
import { ThemeToggle } from '@/ui/components/ThemeToggle.tsx'
import { UndoToast } from '@/ui/components/UndoToast.tsx'

/** Mesmo valor do breakpoint `sm` do Tailwind (40rem = 640px). */
const DESKTOP_QUERY = '(min-width: 40rem)'

export function App() {
  useGlobalShortcuts()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const pendingCount = usePendingCount()
  useWarnBeforeUnload(pendingCount > 0)

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

  return (
    <DndWorkspace>
      <div className="flex min-h-dvh flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-[13px] font-semibold tracking-tight">
            Matriz de Eisenhower
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <SyncIndicator />
            <SettingsPanel />
            <ThemeToggle />
          </div>
        </header>

        {/*
         * So uma arvore de layout montada por vez - nao as duas com uma
         * escondida por CSS. As duas ao mesmo tempo duplicavam ids (o
         * campo de captura, as zonas soltaveis dos quadrantes) e isso
         * quebrava o dnd-kit: o quadrante que a MobileMatrixView mostra por
         * padrao ("Fazer") virava um alvo de arraste invisivel, porque seu
         * id colidia com uma copia oculta de tamanho zero. useMediaQuery
         * (nao so a classe `sm:`) decide de verdade qual arvore existe.
         */}
        {isDesktop ? (
          <>
            {/* Desktop: matriz 2x2 com a caixa de entrada ao lado (docs secao 5.1-5.2). */}
            <main className="flex min-h-0 flex-1 gap-3 sm:gap-4">
              <MatrixGrid />
              <InboxPanel />
            </main>

            <footer className="shrink-0 text-[11px] text-text-subtle">
              <span>
                Versão {__BUILD_INFO__.sha} · {__BUILD_INFO__.builtAt}
              </span>
            </footer>
          </>
        ) : (
          // Mobile: mini matriz seletora, uma lista por vez (docs secao 5.7).
          <MobileMatrixView />
        )}
      </div>

      <UndoToast />
      <HelpOverlay />
    </DndWorkspace>
  )
}
