import { describe, expect, it } from 'vitest'
import { buildCalendarLink } from './calendarLink.ts'

describe('buildCalendarLink', () => {
  it('monta a URL do Agenda com data final exclusiva (dia seguinte)', () => {
    const url = buildCalendarLink('Preparar 1:1 da semana', '2026-10-15')
    expect(url).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Preparar+1%3A1+da+semana&dates=20261015%2F20261016',
    )
  })

  it('inclui "details" quando informado', () => {
    const url = buildCalendarLink('Cobrar fornecedor', '2026-12-31', 'Ver tarefa na Matriz.')
    expect(url).toContain('details=Ver+tarefa+na+Matriz.')
  })

  it('omite "details" quando nao informado ou vazio', () => {
    expect(buildCalendarLink('T', '2026-10-15')).not.toContain('details=')
    expect(buildCalendarLink('T', '2026-10-15', '')).not.toContain('details=')
  })

  it('atravessa o fim do ano na data final', () => {
    const url = buildCalendarLink('Virada', '2026-12-31')
    expect(url).toContain('dates=20261231%2F20270101')
  })
})
