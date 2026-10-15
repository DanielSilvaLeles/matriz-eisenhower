/**
 * Combina os três campos do Web Share Target (docs secao 8: título, texto,
 * URL) num texto só para `captureItem` - a mesma porta única de qualquer
 * captura, de qualquer origem. Puro: só concatena o que vier preenchido.
 */
export interface ShareTargetParams {
  readonly title?: string | null
  readonly text?: string | null
  readonly url?: string | null
}

export function combineSharedText({ title, text, url }: ShareTargetParams): string | null {
  const parts = [title, text, url].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  )
  if (parts.length === 0) return null
  // " — ", nunca "\n": `captureItem` trata cada LINHA do texto como um item
  // separado (docs secao 5.2, "colar várias linhas vira um item por linha").
  // Juntar título/texto/url com quebra de linha faria um compartilhamento só
  // virar três tarefas na caixa de entrada - achado testando na mão
  // (claude-in-chrome), não nos testes automatizados.
  return parts.join(' — ')
}
