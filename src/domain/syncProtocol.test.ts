import { describe, expect, it } from 'vitest'
import { syncDataSchema, syncRequestSchema, syncResponseSchema } from './syncProtocol.ts'
import { createTask } from './task.ts'

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

describe('syncDataSchema - favoritas', () => {
  const base = createTask(
    { id: '0b8d1d63-2a8f-4a43-9a43-5d6e0f0c1a11', eventId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', title: 'x', quadrant: 'q1', position: 1, device: 'pc' },
    '2026-10-15T10:00:00.000Z',
  ).task

  it('preserva `favorite` vindo do servidor', () => {
    const parsed = syncDataSchema.parse({
      schemaVersion: 2,
      tasks: [{ ...base, favorite: true }],
      task_events: [],
      people: [],
      notes: [],
    })
    expect(parsed.tasks[0]?.favorite).toBe(true)
  })

  it('aceita dado gravado antes do campo existir (sem a chave `favorite`)', () => {
    const parsed = syncDataSchema.parse({ schemaVersion: 2, tasks: [base], task_events: [], people: [], notes: [] })
    expect(parsed.tasks[0]).not.toHaveProperty('favorite')
  })
})
