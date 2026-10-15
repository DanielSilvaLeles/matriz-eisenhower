import { useState } from 'react'
import { usePendingCount } from '@/db/hooks.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import { DndWorkspace } from '@/ui/dnd/DndWorkspace.tsx'
import { useGlobalShortcuts } from '@/ui/shortcuts/useGlobalShortcuts.ts'
import { useAppStartupEffects } from '@/ui/hooks/useAppStartupEffects.ts'
import { useMediaQuery } from '@/ui/hooks/useMediaQuery.ts'
import { useWarnBeforeUnload } from '@/ui/hooks/useWarnBeforeUnload.ts'
import { AppHeaderActions } from '@/ui/components/AppHeaderActions.tsx'
import { GlobalOverlays } from '@/ui/components/GlobalOverlays.tsx'
import { InboxPanel } from '@/ui/components/InboxPanel.tsx'
import { MatrixGrid } from '@/ui/components/MatrixGrid.tsx'
import { MobileMatrixView } from '@/ui/components/MobileMatrixView.tsx'
import { TodayBar, type TodayTarget } from '@/ui/components/TodayBar.tsx'

/** Mesmo valor do breakpoint `sm` do Tailwind (40rem = 640px). */
const DESKTOP_QUERY = '(min-width: 40rem)'

function scrollQuadrantIntoView(quadrant: QuadrantId): void {
  document
    .querySelector(`[data-task-list="${quadrant}"]`)
    ?.closest('section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

export function App() {
  useGlobalShortcuts()
  useAppStartupEffects()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const pendingCount = usePendingCount()
  useWarnBeforeUnload(pendingCount > 0)

  const [inboxCollapsed, setInboxCollapsed] = useState(false)
  const [mobileSelected, setMobileSelected] = useState<QuadrantId>('q1')
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false)

  function handleTodayNavigate(target: TodayTarget): void {
    if (target === 'inbox') {
      if (isDesktop) setInboxCollapsed(false)
      else setMobileInboxOpen(true)
      return
    }
    if (isDesktop) scrollQuadrantIntoView(target)
    else setMobileSelected(target)
  }

  return (
    <DndWorkspace>
      <div className="flex min-h-dvh flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-[13px] font-semibold tracking-tight">
            Matriz de Eisenhower
          </h1>
          <AppHeaderActions />
        </header>

        <TodayBar onNavigate={handleTodayNavigate} />

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
              <InboxPanel collapsed={inboxCollapsed} onCollapsedChange={setInboxCollapsed} />
            </main>

            <footer className="shrink-0 text-[11px] text-text-subtle">
              <span>
                Versão {__BUILD_INFO__.sha} · {__BUILD_INFO__.builtAt}
              </span>
            </footer>
          </>
        ) : (
          // Mobile: mini matriz seletora, uma lista por vez (docs secao 5.7).
          <MobileMatrixView
            selected={mobileSelected}
            onSelectedChange={setMobileSelected}
            inboxOpen={mobileInboxOpen}
            onInboxOpenChange={setMobileInboxOpen}
          />
        )}
      </div>

      <GlobalOverlays />
    </DndWorkspace>
  )
}
