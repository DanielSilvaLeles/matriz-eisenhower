/**
 * Elo de anotação para tarefa (`docs/prompt-anotacoes.md` seção 5.1):
 * linhas que começam com `[ ]` ou `- [ ]` são itens de ação em potencial.
 * Puro - não decide COMO mostrar o botão "→ Caixa de entrada" (isso é da
 * UI), só identifica as linhas e sabe trocar o marcador por `[→]` depois
 * de enviada, para "uma linha já marcada não é enviada de novo sem eu
 * pedir" funcionar sem precisar de nenhum estado além do próprio texto.
 */

const ACTION_MARKER_PATTERN = /^(\s*)(?:- )?\[ \] /u
const SENT_MARKER_PATTERN = /^(\s*)(?:- )?\[→\] /u

export interface ActionLine {
  readonly lineIndex: number
  /** Texto da linha sem o marcador `[ ]`/`- [ ]` - é isso que vira o título da tarefa. */
  readonly text: string
  /** `true` quando a linha já foi enviada (marcador `[→]`) - mostrar sem o botão de enviar de novo. */
  readonly sent: boolean
}

function splitLines(body: string): readonly string[] {
  return body.split(/\r\n|\r|\n/u)
}

/** Lista as linhas de ação (pendentes ou já enviadas) de uma anotação, na ordem em que aparecem. */
export function extractActionLines(body: string): readonly ActionLine[] {
  const lines = splitLines(body)
  const result: ActionLine[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? ''
    const pending = ACTION_MARKER_PATTERN.exec(line)
    if (pending) {
      result.push({ lineIndex, text: line.slice(pending[0].length).trim(), sent: false })
      continue
    }
    const sent = SENT_MARKER_PATTERN.exec(line)
    if (sent) {
      result.push({ lineIndex, text: line.slice(sent[0].length).trim(), sent: true })
    }
  }

  return result
}

/**
 * Troca o marcador `[ ]`/`- [ ] ` da linha pelo índice dado por `[→]`/
 * `- [→] ` - preserva o resto da linha e a indentação. Não faz nada (nem
 * lança) se a linha já estiver marcada como enviada ou não for uma linha
 * de ação de verdade - "uma linha já marcada com `[→]` não é enviada de
 * novo sem eu pedir" (seção 5.1) fica garantido chamando isto uma vez só,
 * logo depois de criar a tarefa.
 */
export function markActionLineSent(body: string, lineIndex: number): string {
  const lines = [...splitLines(body)]
  const line = lines[lineIndex]
  if (line === undefined) return body

  const match = ACTION_MARKER_PATTERN.exec(line)
  if (!match) return body

  const indent = match[1] ?? ''
  const dash = match[0].trimStart().startsWith('-') ? '- ' : ''
  lines[lineIndex] = `${indent}${dash}[→] ${line.slice(match[0].length)}`
  return lines.join('\n')
}
