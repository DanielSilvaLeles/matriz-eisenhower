import { describe, expect, it } from 'vitest'
import { buildDelegationMessage } from './delegationMessage.ts'
import type { Task } from './schema.ts'

const NOW = '2026-10-15T10:00:00.000Z'

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Revisar proposta do fornecedor',
    notes: null,
    quadrant: 'q3',
    status: 'open',
    position: 1000,
    date: null,
    delegated_to: null,
    delegation_context: null,
    expected_outcome: null,
    tags: [],
    source: 'web',
    context: 'work',
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    deleted: false,
    device: 'pc empresa',
    source_note_id: null,
    ...overrides,
  }
}

describe('buildDelegationMessage', () => {
  it('so com o titulo, quando nenhum outro campo foi preenchido', () => {
    const message = buildDelegationMessage(baseTask())
    expect(message).toBe(
      'Oi! Pode me ajudar com: Revisar proposta do fornecedor\nObrigado!',
    )
  })

  it('inclui contexto, resultado esperado e prazo quando preenchidos', () => {
    const message = buildDelegationMessage(
      baseTask({
        delegation_context: 'O fornecedor cobra resposta até sexta.',
        expected_outcome: 'Proposta revisada e aprovada ou com ajustes pedidos.',
        date: '2026-10-20',
      }),
    )

    expect(message).toBe(
      [
        'Oi! Pode me ajudar com: Revisar proposta do fornecedor',
        'Por que é urgente: O fornecedor cobra resposta até sexta.',
        'Resultado esperado: Proposta revisada e aprovada ou com ajustes pedidos.',
        'Prazo para retorno: 20/10/2026',
        'Obrigado!',
      ].join('\n'),
    )
  })

  it('ignora contexto/resultado em branco (so espacos)', () => {
    const message = buildDelegationMessage(
      baseTask({ delegation_context: '   ', expected_outcome: '  ' }),
    )
    expect(message).toBe(
      'Oi! Pode me ajudar com: Revisar proposta do fornecedor\nObrigado!',
    )
  })
})
