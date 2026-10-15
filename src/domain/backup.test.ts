import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup.ts'
import { CURRENT_SCHEMA_VERSION } from './schema.ts'
import { createTask } from './task.ts'

const NOW = '2026-10-15T12:00:00.000Z'

function sampleTask() {
  return createTask(
    {
      id: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      title: 'Revisar PR',
      quadrant: 'q1',
      position: 1000,
      device: 'pc empresa',
    },
    NOW,
  )
}

describe('buildBackup', () => {
  it('inclui a versao do schema atual e o instante da exportacao', () => {
    const { task, event } = sampleTask()
    const backup = buildBackup({ tasks: [task], taskEvents: [event], people: [] }, NOW)

    expect(backup.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(backup.exportedAt).toBe(NOW)
    expect(backup.tasks).toEqual([task])
    expect(backup.task_events).toEqual([event])
  })
})

describe('parseBackup', () => {
  it('aceita um backup valido', () => {
    const { task, event } = sampleTask()
    const backup = buildBackup({ tasks: [task], taskEvents: [event], people: [] }, NOW)

    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.backup.tasks).toHaveLength(1)
    }
  })

  it('recusa texto que nao e JSON, com mensagem clara', () => {
    const result = parseBackup('isto nao e json {{{')
    expect(result).toEqual({ ok: false, error: 'Arquivo não é um JSON válido.' })
  })

  it('recusa JSON que nao tem o formato esperado', () => {
    const result = parseBackup(JSON.stringify({ oi: 'tudo bem' }))
    expect(result.ok).toBe(false)
  })

  it('recusa schemaVersion maior que a atual, para nao corromper dados', () => {
    const { task, event } = sampleTask()
    const backup = buildBackup({ tasks: [task], taskEvents: [event], people: [] }, NOW)
    const futureBackup = { ...backup, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }

    const result = parseBackup(JSON.stringify(futureBackup))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('mais nova')
    }
  })

  it('aceita backup vazio (banco zerado)', () => {
    const backup = buildBackup({ tasks: [], taskEvents: [], people: [] }, NOW)
    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
  })
})
