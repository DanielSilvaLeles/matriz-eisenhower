/**
 * Protocolo de sincronizacao com o Apps Script (docs secao 6.4). Tudo por
 * POST, `Content-Type: text/plain`, corpo JSON - evita pre-voo de CORS e
 * mantem o token fora da URL. O mesmo formato de resposta vale para as
 * quatro acoes: `{ ok: true, revision, checksum, data? }` ou
 * `{ ok: false, error }` - um schema so, sem variante por acao.
 *
 * `data` e o mesmo formato do backup (`src/domain/backup.ts`): schemaVersion
 * + tasks + task_events + people + notes. E tambem o conteudo de
 * `matriz.json` no Drive, por dentro do envelope
 * `{ revision, updatedAt, data }` que o script guarda (ver
 * apps-script/Code.gs).
 *
 * `status` (extensao "Anotações", docs/prompt-anotacoes.md secao 6.3): devolve
 * so `revision`/`checksum`, sem `data` - o app usa para decidir se vale a
 * pena puxar o arquivo inteiro, que so cresce com o volume de anotações.
 */
import { z } from 'zod'
import { noteSchema, personSchema, taskEventSchema, taskSchema } from './schema.ts'

export const syncDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  tasks: z.array(taskSchema),
  task_events: z.array(taskEventSchema),
  people: z.array(personSchema),
  /**
   * `.default([])`, não `z.array(noteSchema)` simples - compatibilidade
   * com o script antigo (docs/prompt-anotacoes.md seção 1.6): a resposta
   * de um script publicado ANTES desta extensão não tem esta chave de
   * jeito nenhum, e um push em modo legado (`src/sync/engine.ts`) também
   * monta o corpo sem ela de propósito, para o checksum calculado pelo
   * script antigo bater com o que o front espera (ver
   * `src/domain/checksum.ts`, `includeNotes: false`).
   */
  notes: z.array(noteSchema).default([]),
})
export type SyncData = z.infer<typeof syncDataSchema>

/**
 * Extensão "Anotações" (docs/prompt-anotacoes.md seção 1.6): vai em toda
 * resposta de sucesso de um script que já conhece esta extensão - a
 * AUSÊNCIA deste campo (não um valor `{notes: false}`) é como o front
 * detecta um script antigo, pelo `ping` ou pelo `pull` do ciclo normal.
 */
export const capabilitiesSchema = z.object({
  notes: z.boolean().optional(),
  status: z.boolean().optional(),
})
export type SyncCapabilities = z.infer<typeof capabilitiesSchema>

export const SYNC_ACTIONS = ['ping', 'status', 'pull', 'push'] as const
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
    /** Ausente so na resposta de `status` (docs/prompt-anotacoes.md secao 6.3). */
    data: syncDataSchema.optional(),
    /** Ausente quando o script e anterior a esta extensao - ver capabilitiesSchema acima. */
    capabilities: capabilitiesSchema.optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(SYNC_ERRORS),
  }),
])
export type SyncResponse = z.infer<typeof syncResponseSchema>
