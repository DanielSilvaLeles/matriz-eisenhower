/**
 * Link pré-preenchido do Google Agenda, sem OAuth (docs secao 5.4 e 13): só
 * um URL que abre a tela de criar evento do Google já com os campos prontos
 * - nada é criado até a pessoa confirmar na própria tela do Google.
 */
import { addDays } from './dateStatus.ts'

function toCalendarDate(date: string): string {
  return date.replaceAll('-', '')
}

/**
 * Evento de dia inteiro: o parâmetro `dates` do Agenda exige a data final
 * EXCLUSIVA - sem somar um dia, o evento de um dia só apareceria com zero
 * dias de duração.
 */
export function buildCalendarLink(title: string, date: string, details?: string): string {
  const start = toCalendarDate(date)
  const end = toCalendarDate(addDays(date, 1))

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
  })
  if (details !== undefined && details !== '') params.set('details', details)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
