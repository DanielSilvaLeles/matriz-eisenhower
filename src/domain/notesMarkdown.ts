/**
 * "Exportar anotações em Markdown" (`docs/prompt-anotacoes.md` seção 7):
 * um único arquivo `.md` com as anotações em ordem cronológica, um
 * cabeçalho por anotação com data/hora de inclusão, título, tags e texto -
 * para levar o conteúdo para outras ferramentas. Pura: devolve a string do
 * arquivo, não escreve nada - `src/ui/notes/` é quem baixa o `.md`.
 */
import type { Note } from './schema.ts'

function firstLineOf(body: string): string {
  return body.split(/\r\n|\r|\n/u)[0] ?? ''
}

function titleOf(note: Note): string {
  const title = note.title ?? firstLineOf(note.body)
  return title.trim() === '' ? 'Sem título' : title
}

function formatIncludedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNoteMarkdown(note: Note): string {
  const lines = [`## ${titleOf(note)}`, '', `**Incluída em:** ${formatIncludedAt(note.created_at)}`]
  if (note.tags.length > 0) lines.push(`**Tags:** ${note.tags.map((tag) => `#${tag}`).join(' ')}`)
  lines.push('', note.body)
  return lines.join('\n')
}

/**
 * Ordem cronológica (mais antiga primeiro, como um diário) - exclui
 * anotações apagadas (a lixeira de 30 dias não é parte do que a pessoa
 * quer levar para outra ferramenta).
 */
export function buildNotesMarkdown(notes: readonly Note[]): string {
  const sorted = notes
    .filter((note) => !note.deleted)
    .toSorted((a, b) => a.created_at.localeCompare(b.created_at))

  if (sorted.length === 0) return '# Anotações\n\nNenhuma anotação ainda.\n'

  const body = sorted.map((note) => formatNoteMarkdown(note)).join('\n\n---\n\n')
  return `# Anotações\n\n${body}\n`
}
