/**
 * Schemas Zod e tipos do modelo de dados (docs secao 10), com dois ajustes
 * justificados no plano da fase 1:
 *
 * - `position` e numero (indice fracionario), nao inteiro sequencial -
 *   ver src/domain/position.ts.
 * - `date` e dia local no formato `YYYY-MM-DD`, nao timestamp. "Prazo",
 *   "Agendada para" e "Cobrar em" sao dias, nao instantes: um timestamp ISO
 *   traria bug de fuso na virada do dia, fazendo a tarefa aparecer como
 *   "Hoje" no dia errado.
 *
 * `created_at`/`updated_at`/`completed_at` sao ISO 8601 UTC com milissegundos
 * (o formato nativo de `new Date().toISOString()`), porque a mesclagem de
 * sync (fase 2) precisa comparar instantes com precisao, nao apenas dias.
 *
 * Nomes de campo em snake_case, como a secao 10 do documento escreve -
 * ver CLAUDE.md para a convencao completa (o envelope do protocolo de sync
 * usa camelCase, e os dois convivem sem camada de mapeamento).
 */
import { z } from 'zod'

export const QUADRANT_IDS = ['q1', 'q2', 'q3', 'q4'] as const

export const TASK_STATUSES = ['open', 'done', 'archived'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_SOURCES = ['web', 'pwa', 'share', 'note'] as const
export type TaskSource = (typeof TASK_SOURCES)[number]

export const TASK_CONTEXTS = ['work', 'personal'] as const
export type TaskContext = (typeof TASK_CONTEXTS)[number]

export const TASK_EVENT_TYPES = [
  'created',
  'moved',
  'completed',
  'reopened',
  'archived',
] as const
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number]

/** Dia local, sem hora. Usado em `date` (Prazo / Agendada para / Cobrar em). */
const localDate = z.iso.date()

/** Instante UTC com milissegundos, como `new Date().toISOString()` produz. */
const timestamp = z.iso.datetime({ precision: 3 })

const uuid = z.uuid()

/** Nome do aparelho, como digitado em Configuracoes (docs secao 5.8). */
const deviceName = z.string().trim().min(1).max(60)

export const taskSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000).nullable(),
  quadrant: z.enum(QUADRANT_IDS).nullable(),
  status: z.enum(TASK_STATUSES),
  position: z.number(),
  date: localDate.nullable(),
  delegated_to: z.string().trim().max(200).nullable(),
  delegation_context: z.string().max(2000).nullable(),
  expected_outcome: z.string().max(2000).nullable(),
  tags: z.array(z.string().trim().min(1).max(60)),
  source: z.enum(TASK_SOURCES),
  context: z.enum(TASK_CONTEXTS),
  created_at: timestamp,
  updated_at: timestamp,
  completed_at: timestamp.nullable(),
  deleted: z.boolean(),
  device: deviceName,
  /**
   * Preenchido quando a tarefa nasceu de uma linha de ação `[ ]`/`- [ ]`
   * enviada de uma anotação (extensão "Anotações", seção 5.1 do prompt
   * correspondente) - aponta para `notes.id`. `null` para toda tarefa
   * criada do jeito normal (captura, "Adicionar tarefa").
   */
  source_note_id: uuid.nullable(),
})
export type Task = z.infer<typeof taskSchema>

export const taskEventSchema = z.object({
  id: uuid,
  task_id: uuid,
  type: z.enum(TASK_EVENT_TYPES),
  from_quadrant: z.enum(QUADRANT_IDS).nullable(),
  to_quadrant: z.enum(QUADRANT_IDS).nullable(),
  at: timestamp,
  device: deviceName,
})
export type TaskEvent = z.infer<typeof taskEventSchema>

export const personSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(200),
  updated_at: timestamp,
})
export type Person = z.infer<typeof personSchema>

/**
 * Anotação (extensão "Anotações + menu inferior", `docs/prompt-anotacoes.md`
 * seção 6.1): texto livre de uma reunião/conversa, diferente de uma "ideia"
 * da caixa de entrada - `title` é opcional (a primeira linha serve de
 * título quando ausente, calculado na UI, não gravado em dobro aqui).
 * `created_at` nunca muda depois de criada (seção 5: "data de inclusão").
 * `deleted`/`deleted_at` dão a lixeira de 30 dias (mesmo espírito do
 * tombstone de tarefa, mas com o próprio carimbo de quando foi apagada,
 * para a mesclagem de conflito da fase 2 poder comparar "editada depois de
 * apagada" com precisão).
 */
export const noteSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200).nullable(),
  body: z.string().max(50_000),
  tags: z.array(z.string().trim().min(1).max(60)),
  created_at: timestamp,
  updated_at: timestamp,
  deleted: z.boolean(),
  deleted_at: timestamp.nullable(),
  device: deviceName,
})
export type Note = z.infer<typeof noteSchema>

/**
 * So local, nunca sincronizado (docs secao 10). `pending_ids`,
 * `last_confirmed_revision` e `last_confirmed_checksum` entram em uso na
 * fase 2; aqui o schema ja reserva o formato para a migracao do Dexie nao
 * precisar mudar de novo.
 */
export const metaSchema = z.object({
  device_name: deviceName,
  last_confirmed_revision: z.number().int().nonnegative().nullable(),
  last_confirmed_checksum: z.string().nullable(),
  pending_ids: z.array(uuid),
  schema_version: z.number().int().positive(),
})
export type Meta = z.infer<typeof metaSchema>

/**
 * Versao atual do schema. Sobe quando o formato de `tasks`/`matriz.json`
 * muda. v2: acrescenta `notes` e `tasks.source_note_id`
 * (`docs/prompt-anotacoes.md` seção 6.1) - ver `src/db/schema.ts` para a
 * migração do Dexie e `src/db/migration.test.ts` para o teste com fixture
 * no formato v1.
 */
export const CURRENT_SCHEMA_VERSION = 2
