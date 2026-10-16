import { HistoryPanel } from './HistoryPanel.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { SyncIndicator } from './SyncIndicator.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/**
 * Agrupa os botoes do canto do cabecalho - so para App.tsx nao estourar o
 * limite de imports do lint.
 *
 * **Bug real em produção, corrigido em duas tentativas:** os quatro itens
 * (indicador de sync + 3 botões de ícone) não cabiam juntos numa linha só
 * nos celulares mais comuns (360-412px) - o último botão (`ThemeToggle`)
 * ficava fisicamente fora do viewport, sem nenhum aviso. A primeira
 * correção usou `flex-wrap` (o texto do indicador caindo pra uma segunda
 * linha com os botões) - funcionava, mas o usuário achou a quebra feia e
 * preferiu **menos informação na barra a uma barra de duas linhas**.
 * Revertido pra uma linha só: `SyncIndicator.tsx` agora mostra um rótulo
 * bem mais curto nos celulares (o resumo completo continua disponível no
 * `title`, ao segurar o dedo/passar o mouse) - curto o bastante pra nunca
 * mais precisar de `flex-wrap` aqui. `overflow-x: hidden` em
 * `src/styles/index.css` continua como rede de segurança, caso algum
 * elemento futuro volte a estourar a largura.
 */
export function AppHeaderActions() {
  return (
    <div className="flex items-center gap-1.5">
      <SyncIndicator />
      <HistoryPanel />
      <SettingsPanel />
      <ThemeToggle />
    </div>
  )
}
