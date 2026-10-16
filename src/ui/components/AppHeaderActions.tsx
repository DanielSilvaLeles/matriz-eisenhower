import { HistoryPanel } from './HistoryPanel.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { SyncIndicator } from './SyncIndicator.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/**
 * Agrupa os botoes do canto do cabecalho - so para App.tsx nao estourar o
 * limite de imports do lint.
 *
 * **Bug real em produção:** sem `flex-wrap`, os quatro itens (indicador de
 * sync + 3 botões de ícone) não cabem juntos numa linha só nos celulares
 * mais comuns (360-412px) - o `SyncIndicator` sozinho já passa de 240px com
 * uma mensagem curta, e bem mais com o resumo de sync confirmado
 * ("Sincronizado às … — N enviadas, M recebidas…"). O container não
 * encolhia nem quebrava linha, então o último botão (`ThemeToggle`) ficava
 * fisicamente fora do viewport - não "escondido", **inexistente na tela**,
 * sem nenhum aviso. `flex-wrap` deixa esse botão cair pra uma segunda linha
 * em vez de desaparecer; `justify-end` mantém tudo alinhado à direita nas
 * duas linhas, como o resto do cabeçalho.
 *
 * `min-w-0` no lugar do antigo `shrink-0`: sem isso, mesmo com
 * `flex-wrap`, esta `div` - sozinha na sua própria linha depois do
 * cabeçalho quebrar (header já tem `flex-wrap`) - continuava do tamanho do
 * seu conteúdo (maior que a linha disponível) em vez de encolher até a
 * largura real da linha; sem encolher a CAIXA, o `flex-wrap` de dentro
 * nunca tinha motivo pra quebrar os filhos.
 */
export function AppHeaderActions() {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <SyncIndicator />
      <HistoryPanel />
      <SettingsPanel />
      <ThemeToggle />
    </div>
  )
}
