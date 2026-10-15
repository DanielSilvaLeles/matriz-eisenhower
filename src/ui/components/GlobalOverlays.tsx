import { TriageOverlay } from '@/ui/triage/TriageOverlay.tsx'
import { HelpOverlay } from './HelpOverlay.tsx'
import { TaskDetailPanel } from './TaskDetailPanel.tsx'
import { UndoToast } from './UndoToast.tsx'

/** Overlays globais, sempre montados - so para App.tsx nao estourar o limite de imports do lint. */
export function GlobalOverlays() {
  return (
    <>
      <UndoToast />
      <HelpOverlay />
      <TaskDetailPanel />
      <TriageOverlay />
    </>
  )
}
