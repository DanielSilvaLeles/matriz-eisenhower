import { describe, expect, it } from 'vitest'
import { syncRequestSchema, syncResponseSchema } from './syncProtocol.ts'

describe('syncRequestSchema', () => {
  it('aceita um ping, so com token e action', () => {
    const result = syncRequestSchema.safeParse({ token: 'segredo', action: 'ping' })
    expect(result.success).toBe(true)
  })

  it('aceita um push com baseRevision, data e allowShrink', () => {
    const result = syncRequestSchema.safeParse({
      token: 'segredo',
      action: 'push',
      baseRevision: 3,
      allowShrink: true,
      data: { schemaVersion: 1, tasks: [], task_events: [], people: [], notes: [] },
    })
    expect(result.success).toBe(true)
  })

  it('recusa sem token', () => {
    expect(syncRequestSchema.safeParse({ action: 'ping' }).success).toBe(false)
  })

  it('recusa action desconhecida', () => {
    expect(
      syncRequestSchema.safeParse({ token: 'x', action: 'apagar_tudo' }).success,
    ).toBe(false)
  })

  it('aceita um status, so com token e action (extensao Anotações, docs secao 6.3)', () => {
    expect(syncRequestSchema.safeParse({ token: 'segredo', action: 'status' }).success).toBe(true)
  })
})

describe('syncResponseSchema', () => {
  it('aceita uma resposta de sucesso', () => {
    const result = syncResponseSchema.safeParse({
      ok: true,
      revision: 5,
      checksum: 'abc123',
      data: { schemaVersion: 1, tasks: [], task_events: [], people: [], notes: [] },
    })
    expect(result.success).toBe(true)
  })

  it('aceita uma resposta de erro, com um dos codigos conhecidos', () => {
    const result = syncResponseSchema.safeParse({ ok: false, error: 'conflict' })
    expect(result.success).toBe(true)
  })

  it('recusa codigo de erro desconhecido', () => {
    expect(
      syncResponseSchema.safeParse({ ok: false, error: 'explodiu' }).success,
    ).toBe(false)
  })

  it('recusa sucesso sem os campos obrigatorios', () => {
    expect(syncResponseSchema.safeParse({ ok: true }).success).toBe(false)
  })

  it('aceita uma resposta de status, sem `data` (extensao Anotações, docs secao 6.3)', () => {
    const result = syncResponseSchema.safeParse({ ok: true, revision: 5, checksum: 'abc123' })
    expect(result.success).toBe(true)
  })
})
