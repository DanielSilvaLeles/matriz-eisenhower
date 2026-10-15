import { describe, expect, it } from 'vitest'
import { isStaleInInbox, relativeTimeFromNow } from './time.ts'

const NOW = '2026-10-15T12:00:00.000Z'

describe('relativeTimeFromNow', () => {
  it('menos de um minuto: "agora"', () => {
    expect(relativeTimeFromNow('2026-10-15T11:59:30.000Z', NOW)).toBe('agora')
  })

  it('minutos', () => {
    expect(relativeTimeFromNow('2026-10-15T11:55:00.000Z', NOW)).toBe('há 5 min')
  })

  it('uma hora, no singular', () => {
    expect(relativeTimeFromNow('2026-10-15T11:00:00.000Z', NOW)).toBe('há 1 h')
  })

  it('varias horas, no plural', () => {
    expect(relativeTimeFromNow('2026-10-15T09:00:00.000Z', NOW)).toBe('há 3 h')
  })

  it('um dia, no singular', () => {
    expect(relativeTimeFromNow('2026-10-14T12:00:00.000Z', NOW)).toBe('há 1 dia')
  })

  it('varios dias, no plural', () => {
    expect(relativeTimeFromNow('2026-10-10T12:00:00.000Z', NOW)).toBe('há 5 dias')
  })
})

describe('isStaleInInbox', () => {
  it('nao esta parado com poucas horas', () => {
    expect(isStaleInInbox('2026-10-15T06:00:00.000Z', NOW)).toBe(false)
  })

  it('fica parado com exatas 24h (o limiar e inclusivo)', () => {
    expect(isStaleInInbox('2026-10-14T12:00:00.000Z', NOW)).toBe(true)
  })

  it('esta parado havendo mais de 24h', () => {
    expect(isStaleInInbox('2026-10-13T12:00:00.000Z', NOW)).toBe(true)
  })
})
