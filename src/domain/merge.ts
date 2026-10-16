/**
 * Mesclagem de sync (docs secao 6.2) - o nucleo do modelo local-first. Pura,
 * sem rede nem banco: le dois estados, devolve um terceiro. `src/sync/`
 * (impuro) e quem busca o estado remoto, chama esta funcao e grava o
 * resultado.
 *
 * Regras:
 * - Para o mesmo `id`, vence quem tem `updated_at` mais recente. Empate:
 *   desempata pelo nome do aparelho (`device`), maior em ordem alfabetica -
 *   arbitrario, mas deterministico, para o resultado nunca depender de qual
 *   aparelho mesclou primeiro.
 * - Exclusao e logica (`deleted: true`): uma seta no tempo so pode andar pra
 *   frente. Se um aparelho editou a tarefa ANTES de outro apaga-la, a
 *   exclusao tem o `updated_at` mais novo e vence - a tarefa nao ressuscita.
 * - `task_events` nao tem como ser "editado" (e um fato: a tarefa foi criada,
 *   movida...), mas pela remota possibilidade de dois aparelhos gerarem o
 *   mesmo id (nao deveria acontecer com UUID, mas a funcao fica
 *   deterministica de qualquer jeito) o desempate usa `at` + `device`, no
 *   mesmo espirito do desempate de tarefas.
 * - `people` tem `updated_at` e `device` como tarefa, entao usa a mesma regra.
 * - Tombstones (`deleted: true`) com mais de 30 dias somem na mesclagem -
 *   ninguem vai desfazer uma exclusao de um mes atras, e manter o registro
 *   para sempre so infla o payload do sync a toa.
 */
import type { Note, Person, Task, TaskEvent } from './schema.ts'

export interface SyncableState {
  readonly tasks: readonly Task[]
  readonly taskEvents: readonly TaskEvent[]
  readonly people: readonly Person[]
  readonly notes: readonly Note[]
}

const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Mais recente vence; empate desempata pelo nome do aparelho. Simetrica de
 * proposito. Usada tambem para `notes` na uniao generica abaixo - a mesma
 * regra de "edicao vs exclusao" das tarefas vale aqui (uma exclusao com
 * `updated_at` mais novo vence; uma edicao mais nova ressuscita). A deteccao
 * de EDICAO CONCORRENTE genuina (que gera copia de conflito, em vez de so
 * escolher um vencedor) e mais especifica e vive em `noteMerge.ts`, chamada
 * pelo motor de sync so no passo local-vs-servidor - ver esse arquivo.
 */
export function pickByUpdatedAt<T extends { updated_at: string; device: string }>(a: T, b: T): T {
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at ? a : b
  return a.device.localeCompare(b.device) >= 0 ? a : b
}

/** Mesma ideia, para task_events - que usam `at` em vez de `updated_at`. */
function pickByAt(a: TaskEvent, b: TaskEvent): TaskEvent {
  if (a.at !== b.at) return (a.at > b.at ? a : b)
  return a.device.localeCompare(b.device) >= 0 ? a : b
}

/**
 * `people` (docs secao 10) nao tem campo `device` - so `id`, `name` e
 * `updated_at`. O empate desempata pelo `id`, nao pelo aparelho: ainda
 * deterministico e simetrico, so com o campo que de fato existe.
 */
function pickPersonWinner(a: Person, b: Person): Person {
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at ? a : b
  return a.id.localeCompare(b.id) >= 0 ? a : b
}

/**
 * Uniao por id com desempate. Comutativa: o resultado (como conjunto) nao
 * depende de qual lista vem primeiro, porque `pickWinner` e simetrica e so
 * decide "qual item sobrevive", nunca "qual lista manda".
 */
function unionWithTieBreak<T extends { id: string }>(
  a: readonly T[],
  b: readonly T[],
  pickWinner: (x: T, y: T) => T,
): T[] {
  const byId = new Map<string, T>()
  for (const item of a) byId.set(item.id, item)
  for (const item of b) {
    const existing = byId.get(item.id)
    byId.set(item.id, existing ? pickWinner(existing, item) : item)
  }
  return [...byId.values()]
}

function isStaleTombstone(entity: { deleted: boolean; updated_at: string }, nowIso: string): boolean {
  if (!entity.deleted) return false
  const ageMs = new Date(nowIso).getTime() - new Date(entity.updated_at).getTime()
  return ageMs > TOMBSTONE_MAX_AGE_MS
}

/**
 * Funde dois estados. Idempotente (mesclar o resultado consigo mesmo nao
 * muda nada - a uniao de um conjunto com ele mesmo e ele mesmo) e
 * comutativa (`mergeState(a, b, now)` e `mergeState(b, a, now)` tem o mesmo
 * conteudo, como conjunto).
 *
 * `notes` entra na mesma uniao+desempate generica que `tasks` ja usa -
 * cobre "mesma anotacao sem edicao concorrente" e "edicao vs exclusao"
 * (docs/prompt-anotacoes.md secao 6.2) de graca, por serem exatamente a
 * mesma regra. O caso que PRECISA de tratamento especial (edicao
 * concorrente genuina -> copia de conflito, texto nunca descartado) fica
 * fora desta funcao, em `noteMerge.ts` - chamado so no passo principal do
 * ciclo de sync (local vs servidor), nunca na remesclagem de protecao
 * contra escrita em voo (`applyAndConfirm`), onde so o MESMO aparelho
 * poderia "colidir com si mesmo" e gerar uma copia de conflito espuria.
 */
export function mergeState(a: SyncableState, b: SyncableState, nowIso: string): SyncableState {
  const tasks = unionWithTieBreak(a.tasks, b.tasks, pickByUpdatedAt).filter(
    (task) => !isStaleTombstone(task, nowIso),
  )
  const notes = unionWithTieBreak(a.notes, b.notes, pickByUpdatedAt).filter(
    (note) => !isStaleTombstone(note, nowIso),
  )

  return {
    tasks,
    taskEvents: unionWithTieBreak(a.taskEvents, b.taskEvents, pickByAt),
    people: unionWithTieBreak(a.people, b.people, pickPersonWinner),
    notes,
  }
}
