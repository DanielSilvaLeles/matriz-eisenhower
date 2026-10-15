/**
 * Interpretacao do texto digitado ou colado na captura (docs secao 5.2).
 * Puro: so string para dentro, string/array para fora.
 */

const TAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu

export interface ExtractedCapture {
  readonly title: string
  readonly tags: readonly string[]
}

/**
 * `#tag` no texto vira tag (uso para marcar projeto). Nada mais e
 * interpretado - sem `@pessoa`, sem `!prioridade`, sem markdown. O `#tag`
 * sai do titulo (title fica limpo) e entra em `tags`, em minusculas para
 * "#Fornecedor" e "#fornecedor" caírem na mesma tag.
 */
export function extractTags(text: string): ExtractedCapture {
  const seen = new Set<string>()
  const tags: string[] = []

  const title = text
    .replaceAll(TAG_PATTERN, (_match, word: string) => {
      const tag = word.toLowerCase()
      if (!seen.has(tag)) {
        seen.add(tag)
        tags.push(tag)
      }
      return ''
    })
    .replaceAll(/[ \t]{2,}/gu, ' ')
    .trim()

  return { title, tags }
}

/**
 * Texto colado de uma vez com varias linhas vira um item por linha
 * (docs secao 5.2). Linhas vazias (inclusive so espaco) sao descartadas.
 */
export function splitCaptureLines(text: string): readonly string[] {
  return text
    .split(/\r\n|\r|\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
