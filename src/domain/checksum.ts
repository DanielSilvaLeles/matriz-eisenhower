/**
 * Checksum do estado sincronizado (docs secao 6.1, passo 4): depois de
 * gravar no Drive, o app rele e compara o checksum com o local - so entao
 * marca "Confirmado". Para essa comparacao fazer sentido, o calculo
 * precisa ser **bit-a-bit identico** nos dois lados: aqui (WebCrypto) e no
 * Apps Script (`Utilities.computeDigest`, ver apps-script/Code.gs).
 *
 * SHA-256 hex sobre um JSON canonico: arrays ordenados por `id`, chaves de
 * objeto em ordem alfabetica, sem espaco nenhum, `undefined` tratado como
 * ausente. Qualquer uma dessas regras que divergir entre o front e o script
 * faz os dois calcularem hashes diferentes para o mesmo conteudo - por isso
 * `apps-script/Code.gs` repete esta mesma logica em Apps Script Language, e
 * `testChecksum()` la existe so para comparar contra o fixture daqui.
 */
import type { Note, Person, Task, TaskEvent } from './schema.ts'

export interface ChecksumContents {
  readonly tasks: readonly Task[]
  readonly taskEvents: readonly TaskEvent[]
  readonly people: readonly Person[]
  readonly notes: readonly Note[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item))

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))

    const sorted: Record<string, unknown> = {}
    for (const [key, v] of entries) sorted[key] = sortKeysDeep(v)
    return sorted
  }

  return value
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id)
}

/**
 * `includeNotes: false` (extensão "Anotações", docs/prompt-anotacoes.md
 * seção 1.6 - "compatibilidade com o script antigo"): omite a chave
 * `notes` por completo, não só manda `[]` - é exatamente o JSON canonico
 * que este arquivo produzia ANTES desta extensão (um script antigo, que
 * nunca ouviu falar de anotações, calcula o checksum sem essa chave).
 * `[]` apareceria como `"notes":[]` no JSON e mudaria o hash mesmo sem
 * nenhuma anotação existir - o motor de sync usa este modo so quando
 * detecta, pelo `capabilities` do `ping`/`pull`, que está falando com um
 * script que ainda não foi reimplantado com esta extensão.
 */
export function canonicalJSON(contents: ChecksumContents, includeNotes = true): string {
  const payload = includeNotes
    ? {
        tasks: contents.tasks.toSorted(byId),
        task_events: contents.taskEvents.toSorted(byId),
        people: contents.people.toSorted(byId),
        notes: contents.notes.toSorted(byId),
      }
    : {
        tasks: contents.tasks.toSorted(byId),
        task_events: contents.taskEvents.toSorted(byId),
        people: contents.people.toSorted(byId),
      }
  return JSON.stringify(sortKeysDeep(payload))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * SHA-256 em hexadecimal minusculo do JSON canonico. Assincrono porque
 * `crypto.subtle` (WebCrypto) so expoe uma API baseada em Promise - mesmo
 * sendo um calculo deterministico, nao da para fingir que e sincrono.
 */
export async function computeChecksum(contents: ChecksumContents, includeNotes = true): Promise<string> {
  const json = canonicalJSON(contents, includeNotes)
  const bytes = new TextEncoder().encode(json)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(new Uint8Array(digest))
}
