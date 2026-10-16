/**
 * Deteccao de edicao concorrente genuina em anotacoes
 * (`docs/prompt-anotacoes.md` secao 6.2) - o cuidado extra que `merge.ts`
 * (generico, "vence o `updated_at` mais recente") nao pode dar, porque para
 * texto de anotacao isso PODE PERDER conteudo escrito de verdade. Pura, sem
 * rede nem banco - so `src/sync/engine.ts` chama isto, e so no passo
 * principal do ciclo (local vs servidor).
 *
 * Criterio de "edicao concorrente": a nota tem alteracao local pendente
 * (`pendingNoteIds`, o mesmo `meta.pending_ids` que ja existe para tarefas)
 * E a versao do servidor mudou DEPOIS da ultima sincronizacao confirmada
 * por este aparelho (`lastConfirmedAt`, novo campo em `Meta` - ver
 * `src/db/metaRepo.ts`). Sem essas duas condicoes juntas nao ha conflito de
 * verdade:
 * - So pendente, servidor igual ao que já víamos: a edição local é
 *   simplesmente mais nova - `pickByUpdatedAt` já resolve isso sem copia.
 * - Servidor mudou, mas esta nota NÃO está pendente aqui: este aparelho não
 *   editou - não há nada do lado local para preservar.
 *
 * Quando os dois valem: NENHUMA versao e descartada. A vencedora
 * (`pickByUpdatedAt`, a mesma regra de sempre) fica no `id` original; a
 * perdedora vira uma anotacao NOVA ("cópia de conflito"), com título
 * marcado e o mesmo corpo - para a pessoa revisar e apagar o que não
 * quiser, nunca para o app decidir por ela.
 */
import { pickByUpdatedAt } from './merge.ts'
import type { Note } from './schema.ts'

export interface NoteConflict {
  readonly noteId: string
  readonly loser: Note
}

function sameContent(a: Note, b: Note): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Compara o estado local com o que o servidor devolveu e aponta toda
 * edicao concorrente genuina. Nao resolve nada por si so - devolve so a
 * lista de "este id colidiu, e isto que ia se perder" para
 * `buildConflictCopies` transformar em anotacoes novas.
 */
export function detectNoteConflicts(
  localNotes: readonly Note[],
  remoteNotes: readonly Note[],
  pendingNoteIds: readonly string[],
  lastConfirmedAt: string | null,
): readonly NoteConflict[] {
  const pending = new Set(pendingNoteIds)
  const remoteById = new Map(remoteNotes.map((note) => [note.id, note]))
  const conflicts: NoteConflict[] = []

  for (const local of localNotes) {
    if (!pending.has(local.id)) continue
    const remote = remoteById.get(local.id)
    if (!remote) continue
    if (sameContent(local, remote)) continue

    const remoteChangedSinceConfirm = lastConfirmedAt === null || remote.updated_at > lastConfirmedAt
    if (!remoteChangedSinceConfirm) continue

    const winner = pickByUpdatedAt(local, remote)
    const loser = winner === local ? remote : local
    conflicts.push({ noteId: local.id, loser })
  }

  return conflicts
}

function firstLineOf(body: string): string {
  return body.split(/\r\n|\r|\n/u)[0] ?? ''
}

/**
 * "DD/MM HH:MM", sem virgula - `toLocaleString` com date+time juntos no
 * pt-BR insere uma virgula entre as duas partes (`15/10, 14:32`), diferente
 * do formato que o prompt pede ("conflito 15/10 14:32 do aparelho X").
 * Duas chamadas separadas (data, depois hora) e juntar com espaco evita a
 * virgula sem precisar montar a string campo a campo.
 */
function formatConflictStamp(nowIso: string): string {
  const date = new Date(nowIso)
  const datePart = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

function conflictTitle(loser: Note, nowIso: string): string {
  const base = loser.title ?? firstLineOf(loser.body)
  return `${base} (conflito ${formatConflictStamp(nowIso)} do aparelho ${loser.device})`
}

/**
 * Constrói as anotações-cópia a partir dos conflitos detectados.
 * `generateId` fica a cargo de quem chama (impuro, `crypto.randomUUID()` de
 * verdade) - o mesmo padrão de `src/domain/task.ts` (`id`/`now` recebidos,
 * nunca gerados aqui dentro), para esta função continuar pura e testável
 * com ids previsíveis.
 */
export function buildConflictCopies(
  conflicts: readonly NoteConflict[],
  nowIso: string,
  device: string,
  generateId: () => string,
): readonly Note[] {
  return conflicts.map((conflict) => ({
    id: generateId(),
    title: conflictTitle(conflict.loser, nowIso),
    body: conflict.loser.body,
    tags: conflict.loser.tags,
    created_at: nowIso,
    updated_at: nowIso,
    deleted: false,
    deleted_at: null,
    device,
  }))
}
