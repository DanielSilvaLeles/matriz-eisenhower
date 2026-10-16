import { useState } from 'react'
import { usePendingCount } from '@/db/hooks.ts'
import type { QuadrantId } from '@/domain/quadrant.ts'
import { DndWorkspace } from '@/ui/dnd/DndWorkspace.tsx'
import { useGlobalShortcuts } from '@/ui/shortcuts/useGlobalShortcuts.ts'
import { useAppStartupEffects } from '@/ui/hooks/useAppStartupEffects.ts'
import { useMediaQuery } from '@/ui/hooks/useMediaQuery.ts'
import { useWarnBeforeUnload } from '@/ui/hooks/useWarnBeforeUnload.ts'
import { GlobalOverlays } from '@/ui/components/GlobalOverlays.tsx'
import { HeaderBar } from '@/ui/components/HeaderBar.tsx'
import { MainContent } from '@/ui/components/MainContent.tsx'
import { MobileQuickActions } from '@/ui/components/MobileQuickActions.tsx'
import type { TodayTarget } from '@/ui/components/TodayBar.tsx'

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
        <HeaderBar isDesktop={isDesktop} />

        <MainContent
          isDesktop={isDesktop}
          inboxCollapsed={inboxCollapsed}
          onInboxCollapsedChange={setInboxCollapsed}
          mobileSelected={mobileSelected}
          onMobileSelectedChange={setMobileSelected}
          mobileInboxOpen={mobileInboxOpen}
          onMobileInboxOpenChange={setMobileInboxOpen}
          onTodayNavigate={handleTodayNavigate}
        />
      </div>

      {isDesktop ? null : <MobileQuickActions />}
      <GlobalOverlays />
    </DndWorkspace>
  )
}
