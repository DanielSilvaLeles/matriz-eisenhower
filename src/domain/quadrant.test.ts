import { describe, expect, it } from 'vitest'
import {
  MAX_OPEN_TASKS,
  QUADRANTS,
  WARN_OPEN_TASKS,
  isAtOrOverLimit,
  isNearLimit,
  isOverLimit,
  quadrantFor,
  quadrantMeta,
  type QuadrantId,
} from './quadrant.ts'

describe('quadrantFor', () => {
  // A tabela da secao 3 do documento, verificada caso a caso.
  it.each([
    [true, true, 'q1'],
    [false, true, 'q2'],
    [true, false, 'q3'],
    [false, false, 'q4'],
  ] as const)(
    'urgente=%s importante=%s cai em %s',
    (urgent, important, expected) => {
      expect(quadrantFor(urgent, important)).toBe(expected)
    },
  )

  it('concorda com os eixos declarados em cada quadrante', () => {
    for (const q of QUADRANTS) {
      expect(quadrantFor(q.urgent, q.important)).toBe(q.id)
    }
  })
})

describe('layout canonico', () => {
  it('lista os quadrantes na ordem espacial da grade', () => {
    expect(QUADRANTS.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4'])
  })

  it('coloca os urgentes a esquerda e os importantes em cima', () => {
    const [topLeft, topRight, bottomLeft, bottomRight] = QUADRANTS

    // Colunas sao a urgencia: esquerda urgente, direita nao urgente.
    expect([topLeft?.urgent, bottomLeft?.urgent]).toEqual([true, true])
    expect([topRight?.urgent, bottomRight?.urgent]).toEqual([false, false])

    // Linhas sao a importancia: em cima importante, embaixo nao.
    expect([topLeft?.important, topRight?.important]).toEqual([true, true])
    expect([bottomLeft?.important, bottomRight?.important]).toEqual([false, false])
  })

  it('da a cada quadrante um verbo de acao proprio', () => {
    expect(QUADRANTS.map((q) => q.verb)).toEqual([
      'Fazer',
      'Agendar',
      'Delegar',
      'Eliminar',
    ])
  })

  it('rotula a data conforme o quadrante, e deixa Q4 sem data', () => {
    expect(quadrantMeta('q1').dateLabel).toBe('Prazo')
    expect(quadrantMeta('q2').dateLabel).toBe('Agendada para')
    expect(quadrantMeta('q3').dateLabel).toBe('Cobrar em')
    expect(quadrantMeta('q4').dateLabel).toBeNull()
  })

  it('encontra o metadado pelo id', () => {
    for (const id of ['q1', 'q2', 'q3', 'q4'] satisfies QuadrantId[]) {
      expect(quadrantMeta(id).id).toBe(id)
    }
  })
})

describe('limite de tarefas abertas por quadrante', () => {
  it('avisa antes de encher, a partir de 8', () => {
    expect(isNearLimit(WARN_OPEN_TASKS - 1)).toBe(false)
    expect(isNearLimit(WARN_OPEN_TASKS)).toBe(true)
    expect(isNearLimit(MAX_OPEN_TASKS - 1)).toBe(true)
  })

  it('para de avisar "perto" quando ja esta cheio', () => {
    expect(isNearLimit(MAX_OPEN_TASKS)).toBe(false)
  })

  it('considera cheio em 10 e estourado acima de 10', () => {
    expect(isAtOrOverLimit(MAX_OPEN_TASKS - 1)).toBe(false)
    expect(isAtOrOverLimit(MAX_OPEN_TASKS)).toBe(true)

    expect(isOverLimit(MAX_OPEN_TASKS)).toBe(false)
    expect(isOverLimit(MAX_OPEN_TASKS + 1)).toBe(true)
  })

  it('aceita quadrante vazio sem avisar nada', () => {
    expect(isNearLimit(0)).toBe(false)
    expect(isAtOrOverLimit(0)).toBe(false)
    expect(isOverLimit(0)).toBe(false)
  })
})
