import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateBadgeFor,
  formatDateShortBr,
  nextWeekMonday,
  showsMissingDateWarning,
  thisWeekFriday,
  tomorrow,
} from './dateStatus.ts'

describe('addDays', () => {
  it('soma dias dentro do mesmo mes', () => {
    expect(addDays('2026-10-15', 3)).toBe('2026-10-18')
  })

  it('atravessa o fim do mes', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
  })

  it('atravessa o fim do ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('tomorrow', () => {
  it('e hoje mais um dia', () => {
    expect(tomorrow('2026-10-15')).toBe('2026-10-16')
  })
})

describe('thisWeekFriday', () => {
  it('numa segunda-feira, e a sexta da mesma semana', () => {
    // 2026-10-12 e uma segunda-feira.
    expect(thisWeekFriday('2026-10-12')).toBe('2026-10-16')
  })

  it('numa sexta-feira, e o proprio dia', () => {
    expect(thisWeekFriday('2026-10-16')).toBe('2026-10-16')
  })

  it('num sabado, rola para a sexta da semana seguinte (a desta semana ja passou)', () => {
    expect(thisWeekFriday('2026-10-17')).toBe('2026-10-23')
  })

  it('num domingo, rola para a sexta da semana seguinte', () => {
    expect(thisWeekFriday('2026-10-18')).toBe('2026-10-23')
  })
})

describe('nextWeekMonday', () => {
  it('numa segunda-feira, e a segunda seguinte (+7 dias)', () => {
    expect(nextWeekMonday('2026-10-12')).toBe('2026-10-19')
  })

  it('num sabado, e a segunda mais proxima', () => {
    expect(nextWeekMonday('2026-10-17')).toBe('2026-10-19')
  })

  it('num domingo, e o dia seguinte', () => {
    expect(nextWeekMonday('2026-10-18')).toBe('2026-10-19')
  })
})

describe('formatDateShortBr', () => {
  it('formata como DD/MM', () => {
    expect(formatDateShortBr('2026-03-07')).toBe('07/03')
  })
})

describe('dateBadgeFor', () => {
  const TODAY = '2026-10-15'

  it('sem data, nenhum selo em nenhum quadrante', () => {
    expect(dateBadgeFor('q1', null, TODAY)).toBeNull()
    expect(dateBadgeFor('q2', null, TODAY)).toBeNull()
    expect(dateBadgeFor('q3', null, TODAY)).toBeNull()
  })

  it('Q2: "hoje" quando a data e hoje', () => {
    expect(dateBadgeFor('q2', TODAY, TODAY)).toBe('hoje')
  })

  it('Q2: "atrasada" quando a data ja passou', () => {
    expect(dateBadgeFor('q2', '2026-10-14', TODAY)).toBe('atrasada')
  })

  it('Q2: sem selo para data futura', () => {
    expect(dateBadgeFor('q2', '2026-10-16', TODAY)).toBeNull()
  })

  it('Q3: "cobrar-hoje" no dia da cobranca e tambem depois (vencida)', () => {
    expect(dateBadgeFor('q3', TODAY, TODAY)).toBe('cobrar-hoje')
    expect(dateBadgeFor('q3', '2026-10-10', TODAY)).toBe('cobrar-hoje')
  })

  it('Q3: sem selo para cobranca futura', () => {
    expect(dateBadgeFor('q3', '2026-10-20', TODAY)).toBeNull()
  })

  it('Q1 nunca tem selo, mesmo com data vencida', () => {
    expect(dateBadgeFor('q1', '2026-10-01', TODAY)).toBeNull()
  })
})

describe('showsMissingDateWarning', () => {
  it('so em Q2, e so sem data', () => {
    expect(showsMissingDateWarning('q2', null)).toBe(true)
    expect(showsMissingDateWarning('q2', '2026-10-15')).toBe(false)
    expect(showsMissingDateWarning('q1', null)).toBe(false)
    expect(showsMissingDateWarning('q3', null)).toBe(false)
  })
})
