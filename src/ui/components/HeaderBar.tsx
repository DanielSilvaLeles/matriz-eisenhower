import { AppHeaderActions } from './AppHeaderActions.tsx'
import { DesktopNav } from './DesktopNav.tsx'

export interface HeaderBarProps {
  isDesktop: boolean
}

/**
 * Título + navegação (desktop) + ações do cabeçalho - agrupado aqui só
 * para App.tsx não estourar o limite de dependências do lint (mesmo
 * motivo de AppHeaderActions.tsx/GlobalOverlays.tsx já existirem).
 */
export function HeaderBar({ isDesktop }: HeaderBarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[13px] font-semibold tracking-tight">Matriz de Eisenhower</h1>
        {isDesktop ? <DesktopNav /> : null}
      </div>
      <AppHeaderActions />
    </header>
  )
}
