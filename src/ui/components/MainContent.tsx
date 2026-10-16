import type { QuadrantId } from '@/domain/quadrant.ts'
import { NotesScreen } from '@/ui/notes/NotesScreen.tsx'
import { useRoute } from '@/ui/router/useRoute.ts'
import { InboxPanel } from './InboxPanel.tsx'
import { MatrixGrid } from './MatrixGrid.tsx'
import { MobileMatrixView } from './MobileMatrixView.tsx'
import { TodayBar, type TodayTarget } from './TodayBar.tsx'

export interface MainContentProps {
  isDesktop: boolean
  inboxCollapsed: boolean
  onInboxCollapsedChange: (collapsed: boolean) => void
  mobileSelected: QuadrantId
  onMobileSelectedChange: (quadrant: QuadrantId) => void
  mobileInboxOpen: boolean
  onMobileInboxOpenChange: (open: boolean) => void
  onTodayNavigate: (target: TodayTarget) => void
}

/**
 * Matriz OU Anotações, nunca as duas montadas junto - a rota decide qual
 * (extensão "Anotações", `docs/prompt-anotacoes.md` seção 4). Agrupado
 * aqui só para App.tsx não estourar o limite de dependências do lint
 * (mesmo motivo de AppHeaderActions.tsx/GlobalOverlays.tsx/HeaderBar.tsx).
 */
export function MainContent({
  isDesktop,
  inboxCollapsed,
  onInboxCollapsedChange,
  mobileSelected,
  onMobileSelectedChange,
  mobileInboxOpen,
  onMobileInboxOpenChange,
  onTodayNavigate,
}: MainContentProps) {
  const route = useRoute()

  if (route.screen !== 'matrix') return <NotesScreen />

  return (
    <>
      <TodayBar onNavigate={onTodayNavigate} />

      {/*
       * So uma arvore de layout montada por vez - nao as duas com uma
       * escondida por CSS. As duas ao mesmo tempo duplicavam ids (o campo
       * de captura, as zonas soltaveis dos quadrantes) e isso quebrava o
       * dnd-kit: o quadrante que a MobileMatrixView mostra por padrao
       * ("Fazer") virava um alvo de arraste invisivel, porque seu id
       * colidia com uma copia oculta de tamanho zero. useMediaQuery (nao
       * so a classe `sm:`) decide de verdade qual arvore existe.
       */}
      {isDesktop ? (
        <>
          {/* Desktop: matriz 2x2 com a caixa de entrada ao lado (docs secao 5.1-5.2). */}
          <main className="flex min-h-0 flex-1 gap-3 sm:gap-4">
            <MatrixGrid />
            <InboxPanel collapsed={inboxCollapsed} onCollapsedChange={onInboxCollapsedChange} />
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
          onSelectedChange={onMobileSelectedChange}
          inboxOpen={mobileInboxOpen}
          onInboxOpenChange={onMobileInboxOpenChange}
        />
      )}
    </>
  )
}
