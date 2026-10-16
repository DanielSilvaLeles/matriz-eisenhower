/**
 * Formato do arquivo de backup (docs secao 5.8): tudo que o banco local
 * guarda, numa unica estrutura JSON. E o mesmo formato que `matriz.json`
 * vai usar na fase 2 (docs secao 10) - schemaVersion incluido de proposito,
 * para o app recusar (em vez de corromper) um arquivo mais novo do que ele
 * entende.
 */
import { z } from 'zod'
import {
  CURRENT_SCHEMA_VERSION,
  noteSchema,
  personSchema,
  taskEventSchema,
  taskSchema,
  type Note,
  type Person,
  type Task,
  type TaskEvent,
} from './schema.ts'

export const backupSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.iso.datetime({ precision: 3 }),
  tasks: z.array(taskSchema),
  task_events: z.array(taskEventSchema),
  people: z.array(personSchema),
  /**
   * `.default([])` - compatibilidade com um backup exportado ANTES da
   * extensão "Anotações" (docs/prompt-anotacoes.md seção 7): esse arquivo
   * não tem a chave `notes` de jeito nenhum, e importá-lo não pode falhar
   * só por isso.
   */
  notes: z.array(noteSchema).default([]),
})
export type Backup = z.infer<typeof backupSchema>

export interface BackupContents {
  readonly tasks: readonly Task[]
  readonly taskEvents: readonly TaskEvent[]
  readonly people: readonly Person[]
  readonly notes: readonly Note[]
}

export function buildBackup(contents: BackupContents, exportedAt: string): Backup {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt,
    tasks: [...contents.tasks],
    task_events: [...contents.taskEvents],
    people: [...contents.people],
    notes: [...contents.notes],
  }
}

export type ParseBackupResult =
  | { readonly ok: true; readonly backup: Backup }
  | { readonly ok: false; readonly error: string }

/**
 * Valida o texto de um arquivo importado. Tres jeitos de falhar, cada um
 * com uma mensagem que diz o que fazer - nunca "erro desconhecido"
 * (docs secao 5.8, mesmo espirito das mensagens de erro de sincronizacao).
 */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Arquivo não é um JSON válido.' }
  }

  const result = backupSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, error: 'Arquivo não tem o formato de backup esperado.' }
  }

  if (result.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Este backup foi feito por uma versão mais nova do app. Atualize o app antes de importar.',
    }
  }

  return { ok: true, backup: result.data }
}
