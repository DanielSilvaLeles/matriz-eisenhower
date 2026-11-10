/**
 * Checksum do documento sincronizado - TERCEIRA cópia da mesma
 * canonicalização de `src/domain/checksum.ts` (front, WebCrypto) e
 * `apps-script/Code.gs` (`computeChecksum_`). Precisa ser bit a bit
 * idêntica às duas: chaves de objeto em ordem alfabética, arrays de
 * entidade ordenados por `id`, sem espaço, `undefined` tratado como
 * ausente. `test/checksum.test.ts` confere contra o FIXTURE_HASH e contra
 * a função do front importada direto - se uma das três mudar, as outras
 * mudam junto.
 */
import { createHash } from 'node:crypto'
import { isRecord } from './json.ts'

export interface SyncData {
  schemaVersion: number
  tasks: Record<string, unknown>[]
  task_events: Record<string, unknown>[]
  people: Record<string, unknown>[]
  notes: Record<string, unknown>[]
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item))
  if (isRecord(value)) {
    const source = value
    const sorted: Record<string, unknown> = {}
    // `sort()` sem comparador (ordem de code unit UTF-16), igual ao Code.gs.
    for (const key of Object.keys(source).toSorted()) {
      if (source[key] !== undefined) sorted[key] = sortKeysDeep(source[key])
    }
    return sorted
  }
  return value
}

function sortById(list: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return list.toSorted((a, b) => {
    const idA = String(a['id'])
    const idB = String(b['id'])
    if (idA < idB) return -1
    if (idA > idB) return 1
    return 0
  })
}

export function canonicalJson(data: SyncData): string {
  return JSON.stringify(
    sortKeysDeep({
      tasks: sortById(data.tasks),
      task_events: sortById(data.task_events),
      people: sortById(data.people),
      notes: sortById(data.notes),
    }),
  )
}

export function computeChecksum(data: SyncData): string {
  return createHash('sha256').update(canonicalJson(data), 'utf8').digest('hex')
}
