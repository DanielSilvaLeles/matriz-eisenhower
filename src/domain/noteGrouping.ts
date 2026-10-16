/**
 * Agrupamento da lista de anotações por dia de inclusão
 * (`docs/prompt-anotacoes.md` seção 4): "Hoje", "Ontem", depois a data
 * completa ("quarta, 14/10/2026"). Pura: recebe `today` como parâmetro
 * (mesmo padrão de `src/domain/dateStatus.ts`), não lê o relógio.
 *
 * "Fuso America/Sao_Paulo" (seção 4) é satisfeito pela mesma convenção já
 * usada em todo o app: `today`/`localDateOf` seguem o relógio LOCAL do
 * aparelho (`src/domain/time.ts`), não um fuso fixo via `Intl` - é a mesma
 * leitura que já vale para "Hoje"/"Atrasada" em Q2/Q3.
 */
import { addDays } from './dateStatus.ts'
import { localDateOf } from './time.ts'
import type { Note } from './schema.ts'

export interface NoteGroup {
  readonly label: string
  readonly day: string
  readonly notes: readonly Note[]
}

function formatFullDateBr(date: string): string {
  const parts = date.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  const local = new Date(year, month - 1, day)
  const weekday = local.toLocaleDateString('pt-BR', { weekday: 'long' })
  const rest = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  return `${weekday}, ${rest}`
}

/**
 * Agrupa pela data de `created_at` - a "data de inclusão", não a de edição
 * (seção 4: a prévia mostra "editada" à parte, mas o agrupamento é sempre
 * por quando a anotação nasceu). Preserva a ordem recebida dentro de cada
 * grupo e a ordem dos grupos é a ordem de PRIMEIRA aparição de cada dia na
 * lista de entrada - quem decide se é mais recente primeiro ou invertido é
 * quem monta `notes` antes de chamar esta função.
 */
export function groupNotesByDay(notes: readonly Note[], today: string): readonly NoteGroup[] {
  const yesterday = addDays(today, -1)
  const byDay = new Map<string, Note[]>()
  const order: string[] = []

  for (const note of notes) {
    const day = localDateOf(note.created_at)
    const bucket = byDay.get(day)
    if (bucket) {
      bucket.push(note)
    } else {
      byDay.set(day, [note])
      order.push(day)
    }
  }

  return order.map((day) => ({
    day,
    label: day === today ? 'Hoje' : day === yesterday ? 'Ontem' : formatFullDateBr(day),
    notes: byDay.get(day) ?? [],
  }))
}
