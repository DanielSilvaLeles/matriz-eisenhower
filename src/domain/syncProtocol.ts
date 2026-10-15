/**
 * Protocolo de sincronizacao com o Apps Script (docs secao 6.4). Tudo por
 * POST, `Content-Type: text/plain`, corpo JSON - evita pre-voo de CORS e
 * mantem o token fora da URL. O mesmo formato de resposta vale para as tres
 * acoes (inclusive `ping`): `{ ok: true, revision, checksum, data }` ou
 * `{ ok: false, error }` - um schema so, sem variante por acao.
 *
 * `data` e o mesmo formato do backup (`src/domain/backup.ts`): schemaVersion
 * + tasks + task_events + people. E tambem o conteudo de `matriz.json` no
 * Drive, por dentro do envelope `{ revision, updatedAt, data }` que o script
 * guarda (ver apps-script/Code.gs).
 */
import { z } from 'zod'
import { personSchema, taskEventSchema, taskSchema } from './schema.ts'

export const syncDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  tasks: z.array(taskSchema),
  task_events: z.array(taskEventSchema),
  people: z.array(personSchema),
})
export type SyncData = z.infer<typeof syncDataSchema>

export const SYNC_ACTIONS = ['ping', 'pull', 'push'] as const
export type SyncAction = (typeof SYNC_ACTIONS)[number]

export const syncRequestSchema = z.object({
  token: z.string().min(1),
  action: z.enum(SYNC_ACTIONS),
  /** Só em `push`: a revisão que o cliente leu antes de calcular `data`. */
  baseRevision: z.number().int().nonnegative().optional(),
  /** Só em `push`: o estado mesclado a gravar. */
  data: syncDataSchema.optional(),
  /**
   * Só em `push`: autoriza reduzir drasticamente o número de tarefas (docs
   * secao 6.4) - protege contra um aparelho com banco vazio apagar tudo por
   * engano.
   */
  allowShrink: z.boolean().optional(),
})
export type SyncRequest = z.infer<typeof syncRequestSchema>

export const SYNC_ERRORS = ['unauthorized', 'conflict', 'invalid', 'busy', 'server'] as const
export type SyncErrorCode = (typeof SYNC_ERRORS)[number]

export const syncResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    revision: z.number().int().nonnegative(),
    checksum: z.string(),
    data: syncDataSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(SYNC_ERRORS),
  }),
])
export type SyncResponse = z.infer<typeof syncResponseSchema>
