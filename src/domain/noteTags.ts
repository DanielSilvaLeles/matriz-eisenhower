/**
 * Tags de anotação (`docs/prompt-anotacoes.md` seção 5): mesmo padrão de
 * reconhecimento de `#tag` que `src/domain/capture.ts` usa para a caixa de
 * entrada - mas, diferente de lá, NÃO remove o `#tag` do texto. O corpo da
 * anotação é o registro literal de uma reunião; apagar o que foi digitado
 * ali desfiguraria o texto (ver `docs/DECISOES-ANOTACOES.md`, item 2).
 */
const TAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu

/** Tags únicas, em minúsculas, na ordem em que aparecem no texto. */
export function extractNoteTags(text: string): readonly string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const match of text.matchAll(TAG_PATTERN)) {
    const word = match[1]
    if (word === undefined) continue
    const tag = word.toLowerCase()
    if (!seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}
