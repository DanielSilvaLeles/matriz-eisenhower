/**
 * Hoje, atraso e cobranca por quadrante (docs secao 5.4), e os atalhos de
 * data da triagem (docs secao 5.3: "Amanhã", "Esta semana", "Semana que
 * vem"). Tudo puro: recebe o dia de hoje como parametro, nunca le o relogio.
 *
 * "Esta semana"/"Semana que vem" tratam a semana como segunda a domingo -
 * o documento fixa so os rotulos dos chips, nao os dias exatos. Leitura
 * escolhida, registrada aqui para nao surpreender: sexta-feira da semana
 * corrente ("esta semana") e segunda-feira da semana seguinte ("semana que
 * vem"), rolando para a semana seguinte quando hoje já passou da sexta.
 */
import type { QuadrantId } from './quadrant.ts'

/** "AAAA-MM-DD" -> ano, mes (1-12) e dia, sem assercao de tipo sobre o array do split. */
function parseLocalDate(date: string): { readonly year: number; readonly month: number; readonly day: number } {
  const [yearText, monthText, dayText] = date.split('-')
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) }
}

/** Dia local (AAAA-MM-DD) + n dias corridos, sem passar por fuso horario (UTC). */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseLocalDate(date)
  const next = new Date(year, month - 1, day + days)
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 1 (segunda) a 7 (domingo) - ISO, para a aritmetica da semana abaixo ficar simples. */
function isoWeekday(date: string): number {
  const { year, month, day } = parseLocalDate(date)
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 ? 7 : weekday
}

export function tomorrow(today: string): string {
  return addDays(today, 1)
}

/** Sexta-feira da semana corrente; se hoje já passou da sexta, a da semana seguinte. */
export function thisWeekFriday(today: string): string {
  const diff = 5 - isoWeekday(today)
  return addDays(today, diff >= 0 ? diff : diff + 7)
}

/** Segunda-feira da semana seguinte a de hoje. */
export function nextWeekMonday(today: string): string {
  const diff = 8 - isoWeekday(today)
  return addDays(today, diff)
}

/** "DD/MM", para o chip de data compacto nas linhas de tarefa. */
export function formatDateShortBr(date: string): string {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

export type DateBadge = 'hoje' | 'atrasada' | 'cobrar-hoje'

/**
 * Selo de data por quadrante (docs secao 5.4): Q2 mostra "Hoje"/"Atrasada";
 * Q3 mostra "Cobrar hoje" no dia da cobranca OU depois (uma cobranca vencida
 * continua merecendo o sinal, nao so o dia exato). Q1 e Q4 nao tem selo - Q1
 * porque o documento so pede a data como informativa ("Prazo"), Q4 porque
 * nao tem campo de data.
 */
export function dateBadgeFor(
  quadrant: QuadrantId,
  date: string | null,
  today: string,
): DateBadge | null {
  if (date === null) return null
  if (quadrant === 'q2') {
    if (date < today) return 'atrasada'
    if (date === today) return 'hoje'
    return null
  }
  if (quadrant === 'q3' && date <= today) return 'cobrar-hoje'
  return null
}

/** "Sem data" em âmbar so faz sentido em Q2 (docs 5.4: "tarefa de Q2 sem data é só um desejo"). */
export function showsMissingDateWarning(quadrant: QuadrantId, date: string | null): boolean {
  return quadrant === 'q2' && date === null
}
