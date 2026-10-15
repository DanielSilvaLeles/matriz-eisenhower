import { HistoryPanel } from './HistoryPanel.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { SyncIndicator } from './SyncIndicator.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/** Agrupa os botoes do canto do cabecalho - so para App.tsx nao estourar o limite de imports do lint. */
export function AppHeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <SyncIndicator />
      <HistoryPanel />
      <SettingsPanel />
      <ThemeToggle />
    </div>
  )
}
