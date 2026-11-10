/**
 * Mapa entre as entidades do JSON de sync e as tabelas do Postgres. As
 * chaves do JSON e os nomes de coluna são os mesmos (snake_case, como o
 * front já usa) - não existe camada de tradução de nomes, só de TIPOS, e é
 * exatamente nela que mora o risco: o checksum relido só bate se cada
 * valor voltar idêntico ao que entrou (ver `rowToItem`).
 */
import { isRecord } from './json.ts'

/**
 * - `timestamp`: ISO 8601 UTC com milissegundos, sempre 24 caracteres
 *   (`new Date().toISOString()`). Guardado em `timestamptz`, devolvido por
 *   `Date#toISOString()` - o mesmo formato, garantido pela validação.
 * - `date`: dia local `YYYY-MM-DD`, guardado em `date`. O parser do `pg`
 *   para esse tipo é trocado em `db.ts` para devolver o texto cru (o padrão
 *   criaria um `Date` à meia-noite LOCAL - bug de fuso clássico).
 * - `optional-bool`: `favorite` - chave AUSENTE (NULL) é diferente de
 *   `false` para o checksum. NULL nunca vira `false` na volta.
 */
export type ColumnKind = 'uuid' | 'text' | 'float' | 'date' | 'timestamp' | 'bool' | 'optional-bool' | 'tags'

export interface Column {
  readonly name: string
  readonly kind: ColumnKind
}

export interface Entity {
  /** Chave no JSON e nome da tabela (são iguais). */
  readonly name: 'tasks' | 'task_events' | 'people' | 'notes'
  readonly columns: readonly Column[]
}

const SQL_TYPE: Record<ColumnKind, string> = {
  uuid: 'uuid',
  text: 'text',
  float: 'double precision',
  date: 'date',
  timestamp: 'timestamptz',
  bool: 'boolean',
  'optional-bool': 'boolean',
  tags: 'text[]',
}

export function sqlType(column: Column): string {
  return SQL_TYPE[column.kind]
}

export const ENTITIES: readonly Entity[] = [
  {
    name: 'tasks',
    columns: [
      { name: 'id', kind: 'uuid' },
      { name: 'title', kind: 'text' },
      { name: 'notes', kind: 'text' },
      { name: 'quadrant', kind: 'text' },
      { name: 'status', kind: 'text' },
      { name: 'position', kind: 'float' },
      { name: 'date', kind: 'date' },
      { name: 'delegated_to', kind: 'text' },
      { name: 'delegation_context', kind: 'text' },
      { name: 'expected_outcome', kind: 'text' },
      { name: 'tags', kind: 'tags' },
      { name: 'source', kind: 'text' },
      { name: 'context', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'completed_at', kind: 'timestamp' },
      { name: 'deleted', kind: 'bool' },
      { name: 'device', kind: 'text' },
      { name: 'source_note_id', kind: 'uuid' },
      { name: 'favorite', kind: 'optional-bool' },
    ],
  },
  {
    name: 'task_events',
    columns: [
      { name: 'id', kind: 'uuid' },
      { name: 'task_id', kind: 'uuid' },
      { name: 'type', kind: 'text' },
      { name: 'from_quadrant', kind: 'text' },
      { name: 'to_quadrant', kind: 'text' },
      { name: 'at', kind: 'timestamp' },
      { name: 'device', kind: 'text' },
    ],
  },
  {
    name: 'people',
    columns: [
      { name: 'id', kind: 'uuid' },
      { name: 'name', kind: 'text' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'notes',
    columns: [
      { name: 'id', kind: 'uuid' },
      { name: 'title', kind: 'text' },
      { name: 'body', kind: 'text' },
      { name: 'tags', kind: 'tags' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'deleted', kind: 'bool' },
      { name: 'deleted_at', kind: 'timestamp' },
      { name: 'device', kind: 'text' },
      { name: 'favorite', kind: 'optional-bool' },
    ],
  },
]

/**
 * Item do JSON → registro para `jsonb_to_recordset`: as colunas conhecidas
 * mais `extra` com o resto das chaves (campo opcional novo que ainda não
 * tem coluna - ver o comentário de `extra` na migration 001).
 */
export function itemToRecord(entity: Entity, item: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  const known = new Set(entity.columns.map((c) => c.name))
  for (const [key, value] of Object.entries(item)) {
    if (known.has(key)) record[key] = value
    else extra[key] = value
  }
  record['extra'] = extra
  return record
}

/** Linha do Postgres → item do JSON, exatamente como o front mandou. */
export function rowToItem(entity: Entity, row: Record<string, unknown>): Record<string, unknown> {
  const extra = row['extra']
  const item: Record<string, unknown> = isRecord(extra) ? { ...extra } : {}

  for (const column of entity.columns) {
    const value = row[column.name]
    if (column.kind === 'optional-bool') {
      if (value !== null && value !== undefined) item[column.name] = value
    } else if (column.kind === 'timestamp') {
      item[column.name] = value instanceof Date ? value.toISOString() : null
    } else {
      item[column.name] = value ?? null
    }
  }
  return item
}
