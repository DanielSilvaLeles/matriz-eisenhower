/**
 * Gravar o resultado do ciclo e montar o resumo "Confirmado" - separado de
 * `engine.ts` so pelo limite de linhas do lint (mesma convencao de
 * `tasksRepo.lifecycle.ts` separar de `tasksRepo.ts`), nao por fronteira de
 * dominio real.
 */
import { applyMergedState, readLocalState, type LocalSyncSnapshot } from '@/db/syncRepo.ts'
import { clearPending } from '@/db/metaRepo.ts'
import type { MatrizDB } from '@/db/schema.ts'
import { mergeState, type SyncableState } from '@/domain/merge.ts'

/** Quantas tarefas de `after` são novas ou mudaram em relação a `before` (por id + updated_at). */
function countChanged(before: SyncableState['tasks'], after: SyncableState['tasks']): number {
  const byId = new Map(before.map((task) => [task.id, task]))
  let count = 0
  for (const task of after) {
    const prior = byId.get(task.id)
    if (!prior || prior.updated_at !== task.updated_at) count++
  }
  return count
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * A tarefa OU anotacao com esse id tem o MESMO valor nos dois estados
 * (comparacao profunda via JSON) - `pendingIds` e uma lista unica para as
 * duas entidades (ids sao UUID, sem risco de colisao - ver CLAUDE.md).
 */
function entityUnchanged(a: SyncableState, b: SyncableState, id: string): boolean {
  const va = a.tasks.find((task) => task.id === id) ?? a.notes.find((note) => note.id === id)
  const vb = b.tasks.find((task) => task.id === id) ?? b.notes.find((note) => note.id === id)
  return JSON.stringify(va) === JSON.stringify(vb)
}

/**
 * Grava o resultado do ciclo e confirma a pendencia - o unico lugar que
 * faz isso, chamado pelos dois pontos de saida bem-sucedida do ciclo
 * (nada para empurrar, e push+verificacao OK).
 *
 * **Bug real relatado em produção:** mover uma tarefa (ou qualquer outra
 * edicao) ENQUANTO um ciclo de sync estava em voo desfazia o movimento -
 * `merged` foi calculado a partir do snapshot de `readLocalState` tirado
 * no INÍCIO do ciclo; se a pessoa movesse uma tarefa já existente nesse
 * meio-tempo, essa tarefa (com id presente tanto no snapshot quanto em
 * `merged`, só que com o quadrante antigo) tinha seu valor sobrescrito de
 * volta pelo `bulkPut` de `applyMergedState` - diferente do bug de tarefa
 * NOVA já corrigido antes (que `bulkPut` já protege, por nunca tocar um id
 * ausente de `merged`), aqui o id JÁ estava em `merged`, só que desatualizado.
 *
 * Corrigido relendo o estado local de novo bem antes de gravar
 * (`readLocalState` mais uma vez, o mais perto possível da escrita) e
 * mesclando esse estado FRESCO com `merged` usando a MESMA regra de
 * "vence o `updated_at` mais recente" (`mergeState`) já usada em todo o
 * resto do app - a edição em voo, por ter acontecido por último, sempre
 * vence. O id dessa tarefa fica de fora de `confirmedIds` (ver
 * `entityUnchanged`), então a pendência dela não é limpa por engano -
 * continua marcada para o PRÓXIMO ciclo empurrar de verdade.
 *
 * **De proposito, nao roda `detectNoteConflicts` de novo aqui.** Esta
 * remesclagem e so entre o MESMO aparelho (o que esta correndo este ciclo)
 * em dois instantes - nunca pode ser uma colisao genuina entre dois
 * aparelhos, so a propria edicao em voo vencendo por ser mais nova
 * (`mergeState` ja resolve isso sem copia nenhuma). Gerar copia de
 * conflito aqui so porque um id estava em `pendingIds` seria um falso
 * positivo.
 *
 * `notesSupported`: compatibilidade com o script antigo
 * (docs/prompt-anotacoes.md secao 1.6) - quando `false`, nenhuma anotação
 * foi de fato enviada ao servidor neste ciclo (o motor nunca inclui
 * `notes` no push nem no checksum contra um script assim, ver
 * `src/sync/engine.ts`). Sem esta exclusão, uma anotação pendente que por
 * acaso não mudou entre o snapshot e esta releitura pareceria "confirmada"
 * (`entityUnchanged` acharia os dois valores iguais) mesmo nunca tendo
 * saído deste aparelho - o contador mentiria "sincronizado" para algo que
 * só existe localmente.
 */
export async function applyAndConfirm(
  db: MatrizDB,
  local: LocalSyncSnapshot,
  merged: SyncableState,
  revision: number,
  checksum: string,
  notesSupported: boolean,
): Promise<void> {
  const latestLocal = await readLocalState(db)
  const now = new Date().toISOString()
  const finalState = mergeState(latestLocal, merged, now)
  await applyMergedState(db, finalState)
  const noteIds = new Set(local.notes.map((note) => note.id))
  const confirmedIds = local.pendingIds.filter((id) => {
    if (!notesSupported && noteIds.has(id)) return false
    return entityUnchanged(finalState, merged, id)
  })
  await clearPending(db, revision, checksum, confirmedIds, now)
}

export function buildSummary(
  remoteBefore: SyncableState,
  local: SyncableState,
  merged: SyncableState,
  conflictCount: number,
): string {
  const sent = countChanged(remoteBefore.tasks, merged.tasks)
  const received = countChanged(local.tasks, merged.tasks)
  const base = `${pluralize(sent, 'enviada', 'enviadas')}, ${pluralize(received, 'recebida', 'recebidas')} de outro aparelho. Confirmado.`
  if (conflictCount === 0) return base
  return `${base} ${pluralize(conflictCount, 'cópia de conflito criada', 'cópias de conflito criadas')} - revise em Anotações.`
}
