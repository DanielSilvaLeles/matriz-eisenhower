import { IS_BETA } from '@/appId.ts'
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
        {IS_BETA ? (
          // Build para dois repositórios (docs/prompt-anotacoes.md seção
          // 1.8): `IS_BETA` é `false` em produção, então este selo nunca
          // aparece lá - zero risco de repetir o estouro de largura em
          // 320px já corrigido (ver CLAUDE.md).
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-warn uppercase">
            Beta
          </span>
        ) : null}
        {isDesktop ? <DesktopNav /> : null}
      </div>
      <AppHeaderActions />
    </header>
  )
}
