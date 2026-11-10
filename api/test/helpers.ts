/**
 * Banco de teste: um Postgres de verdade (TEST_DATABASE_URL), zerado e
 * migrado do zero antes de cada arquivo de teste. Os testes que dependem
 * dele são PULADOS sem a variável - nunca apontam para outro banco por
 * engano. Local: um container descartável (ver api/README.md); CI: o
 * service container do workflow.
 */
import { createPool, type Pool } from '../src/db.ts'
import { migrate } from '../src/migrate.ts'
import type { SyncData } from '../src/checksum.ts'

export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'] ?? ''
export const skipWithoutDb = TEST_DATABASE_URL === '' ? 'TEST_DATABASE_URL não definida' : false

export async function freshDatabase(): Promise<Pool> {
  const pool = createPool(TEST_DATABASE_URL)
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  await migrate(pool)
  return pool
}

let counter = 0
/** UUID v4 determinístico e minúsculo, como `crypto.randomUUID()` gera. */
export function uuid(): string {
  counter += 1
  const hex = counter.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

export function task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: uuid(),
    title: 'Revisar PR do time',
    notes: null,
    quadrant: 'q1',
    status: 'open',
    position: 1000,
    date: null,
    delegated_to: null,
    delegation_context: null,
    expected_outcome: null,
    tags: [],
    source: 'web',
    context: 'work',
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
    completed_at: null,
    deleted: false,
    device: 'pc empresa',
    source_note_id: null,
    ...overrides,
  }
}

export function note(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: uuid(),
    title: null,
    body: 'Reunião com o time\n- [ ] mandar ata',
    tags: [],
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
    deleted: false,
    deleted_at: null,
    device: 'celular',
    ...overrides,
  }
}

export function doc(parts: Partial<SyncData> = {}): SyncData {
  return { schemaVersion: 2, tasks: [], task_events: [], people: [], notes: [], ...parts }
}
