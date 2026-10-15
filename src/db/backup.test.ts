import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyBackup, currentCounts, exportBackup } from './backup.ts'
import { MatrizDB } from './schema.ts'
import { addTaskToQuadrant } from './tasksRepo.ts'
import { parseBackup } from '@/domain/backup.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-backup-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('exportBackup', () => {
  it('inclui as tarefas e os eventos existentes', async () => {
    await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    await addTaskToQuadrant(db, 'q2', 'Preparar 1:1')

    const backup = await exportBackup(db)

    expect(backup.tasks).toHaveLength(2)
    expect(backup.task_events).toHaveLength(2)
    expect(backup.people).toHaveLength(0)
  })

  it('o resultado passa pela validacao de parseBackup (roundtrip)', async () => {
    await addTaskToQuadrant(db, 'q1', 'Revisar PR')
    const backup = await exportBackup(db)

    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
  })
})

describe('currentCounts', () => {
  it('conta o que existe agora em cada tabela', async () => {
    await addTaskToQuadrant(db, 'q1', 'Uma tarefa')
    const counts = await currentCounts(db)
    expect(counts).toEqual({ tasks: 1, taskEvents: 1, people: 0 })
  })
})

describe('applyBackup', () => {
  it('substitui o conteudo existente pelo do backup', async () => {
    await addTaskToQuadrant(db, 'q1', 'Tarefa antiga que vai sumir')

    // Um banco "de outro aparelho", com conteudo diferente.
    const other = new MatrizDB(`teste-backup-outro-${crypto.randomUUID()}`)
    try {
      await addTaskToQuadrant(other, 'q3', 'Tarefa que vem do backup')
      const otherBackup = await exportBackup(other)

      await applyBackup(db, otherBackup)

      const restored = await db.tasks.toArray()
      expect(restored).toHaveLength(1)
      expect(restored[0]?.title).toBe('Tarefa que vem do backup')
    } finally {
      await other.delete()
    }
  })

  it('restaura um banco vazio para vazio (exportar e reimportar sem mudanca)', async () => {
    await addTaskToQuadrant(db, 'q1', 'Vai e volta')
    const backup = await exportBackup(db)

    await applyBackup(db, backup)

    const restored = await db.tasks.toArray()
    expect(restored).toHaveLength(1)
    expect(restored[0]?.title).toBe('Vai e volta')
  })
})
