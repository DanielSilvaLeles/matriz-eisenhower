/**
 * Validação estrutural do documento recebido no push - o mesmo espírito de
 * `isValidData_` do Code.gs (confere o que corrompe a mesclagem ou a
 * exibição, não cada refinamento do Zod do front), MAIS os formatos que o
 * Postgres não devolveria idênticos. Com o arquivo JSON, qualquer string
 * voltava como entrou; com colunas tipadas, não:
 *
 * - timestamp fora do formato `YYYY-MM-DDTHH:mm:ss.sssZ` voltaria
 *   normalizado por `toISOString()`;
 * - uuid com maiúsculas voltaria em minúsculas;
 * - texto com o caractere NUL (`\u0000`) o Postgres recusa.
 *
 * Em qualquer desses casos o checksum relido não bateria, então é melhor
 * recusar o push na entrada (`invalid`) do que gravar algo que o front
 * nunca conseguiria confirmar.
 */
import type { SyncData } from './checksum.ts'
import { isRecord } from './json.ts'

const QUADRANTS = ['q1', 'q2', 'q3', 'q4']
const TASK_STATUSES = ['open', 'done', 'archived']
const TASK_SOURCES = ['web', 'pwa', 'share', 'note']
const TASK_CONTEXTS = ['work', 'personal']
const TASK_EVENT_TYPES = ['created', 'moved', 'completed', 'reopened', 'archived']

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u

type Item = Record<string, unknown>

function isText(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('\u0000')
}
function isNonEmptyText(value: unknown): boolean {
  return isText(value) && value.length > 0
}
function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID.test(value)
}
function isTimestamp(value: unknown): boolean {
  return typeof value === 'string' && TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))
}
function isLocalDate(value: unknown): boolean {
  return typeof value === 'string' && LOCAL_DATE.test(value) && !Number.isNaN(Date.parse(value))
}
function nullOr(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === null || check(value)
}
function oneOf(list: readonly string[]): (v: unknown) => boolean {
  return (v) => typeof v === 'string' && list.includes(v)
}
function isTags(value: unknown): boolean {
  return Array.isArray(value) && value.every((tag) => isText(tag))
}
/** `favorite`: ausente, `true` ou `false` - nunca `null` (o front não manda). */
function isOptionalBool(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean'
}

export function isValidTask(t: Item): boolean {
  return (
    isUuid(t['id']) &&
    isNonEmptyText(t['title']) &&
    nullOr(t['notes'], isText) &&
    nullOr(t['quadrant'], oneOf(QUADRANTS)) &&
    oneOf(TASK_STATUSES)(t['status']) &&
    typeof t['position'] === 'number' &&
    Number.isFinite(t['position']) &&
    nullOr(t['date'], isLocalDate) &&
    nullOr(t['delegated_to'], isText) &&
    nullOr(t['delegation_context'], isText) &&
    nullOr(t['expected_outcome'], isText) &&
    isTags(t['tags']) &&
    oneOf(TASK_SOURCES)(t['source']) &&
    oneOf(TASK_CONTEXTS)(t['context']) &&
    isTimestamp(t['created_at']) &&
    isTimestamp(t['updated_at']) &&
    nullOr(t['completed_at'], isTimestamp) &&
    typeof t['deleted'] === 'boolean' &&
    isNonEmptyText(t['device']) &&
    nullOr(t['source_note_id'], isUuid) &&
    isOptionalBool(t['favorite'])
  )
}

export function isValidTaskEvent(e: Item): boolean {
  return (
    isUuid(e['id']) &&
    isUuid(e['task_id']) &&
    oneOf(TASK_EVENT_TYPES)(e['type']) &&
    nullOr(e['from_quadrant'], oneOf(QUADRANTS)) &&
    nullOr(e['to_quadrant'], oneOf(QUADRANTS)) &&
    isTimestamp(e['at']) &&
    isNonEmptyText(e['device'])
  )
}

export function isValidPerson(p: Item): boolean {
  return isUuid(p['id']) && isNonEmptyText(p['name']) && isTimestamp(p['updated_at'])
}

export function isValidNote(n: Item): boolean {
  return (
    isUuid(n['id']) &&
    nullOr(n['title'], isNonEmptyText) &&
    isText(n['body']) &&
    isTags(n['tags']) &&
    isTimestamp(n['created_at']) &&
    isTimestamp(n['updated_at']) &&
    typeof n['deleted'] === 'boolean' &&
    nullOr(n['deleted_at'], isTimestamp) &&
    isNonEmptyText(n['device']) &&
    isOptionalBool(n['favorite'])
  )
}

function allValid(list: unknown, check: (item: Item) => boolean): list is Item[] {
  if (!Array.isArray(list)) return false
  const ids = new Set<unknown>()
  for (const item of list) {
    if (!isRecord(item) || !check(item)) return false
    // Id repetido faria o upsert tocar a mesma linha duas vezes.
    if (ids.has(item['id'])) return false
    ids.add(item['id'])
  }
  return true
}

/**
 * Devolve o documento normalizado (`notes` ausente vira `[]`, como o
 * `normalizeData_` do Code.gs) ou `null` se for inválido.
 */
export function parseSyncData(value: unknown): SyncData | null {
  if (!isRecord(value)) return null
  const schemaVersion = value['schemaVersion']
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) return null
  const notes = value['notes'] === undefined ? [] : value['notes']
  if (
    !allValid(value['tasks'], isValidTask) ||
    !allValid(value['task_events'], isValidTaskEvent) ||
    !allValid(value['people'], isValidPerson) ||
    !allValid(notes, isValidNote)
  ) {
    return null
  }
  return {
    schemaVersion,
    tasks: value['tasks'],
    task_events: value['task_events'],
    people: value['people'],
    notes,
  }
}
