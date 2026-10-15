import { describe, expect, it } from 'vitest'
import { hasDayChanged, isStaleInInbox, localDateOf, relativeTimeFromNow } from './time.ts'

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

// Instantes ao meio-dia UTC de proposito: o dia local correspondente e o
// mesmo em qualquer fuso horario razoavel (-12 a +14), entao o teste nao
// fica dependente do TZ de quem roda (maquina local ou CI).
describe('localDateOf', () => {
  it('extrai o dia local de um instante ISO', () => {
    expect(localDateOf('2026-10-15T12:00:00.000Z')).toBe('2026-10-15')
  })
})

describe('hasDayChanged', () => {
  it('false quando os dois instantes sao do mesmo dia local', () => {
    expect(hasDayChanged('2026-10-15T08:00:00.000Z', '2026-10-15T20:00:00.000Z')).toBe(false)
  })

  it('true quando o segundo instante e de um dia local posterior', () => {
    expect(hasDayChanged('2026-10-14T12:00:00.000Z', '2026-10-15T12:00:00.000Z')).toBe(true)
  })

  it('false quando o segundo instante e ANTERIOR (nao viaja no tempo)', () => {
    expect(hasDayChanged('2026-10-15T12:00:00.000Z', '2026-10-14T12:00:00.000Z')).toBe(false)
  })
})
