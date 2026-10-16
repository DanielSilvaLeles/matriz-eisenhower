/**
 * Motor de sincronizacao (docs secao 6.1): pull -> mesclar -> push ->
 * verificacao. Um unico ciclo compartilhado por todos os gatilhos (abrir o
 * app, focar a aba, a cada 60s visivel, 3s apos editar, voltar a conexao,
 * botao/atalho "Sincronizar agora" - ver src/sync/triggers.ts) atraves de
 * `runSync()`, que de-duplica chamadas concorrentes.
 *
 * Extensao "Anotações" (docs/prompt-anotacoes.md secao 6.3): antes de
 * puxar o arquivo inteiro, um `action: 'status'` barato (so revision +
 * checksum, sem `data`) decide se vale a pena - se nada mudou no servidor
 * desde a ultima sincronizacao confirmada E nao ha nada pendente aqui, o
 * ciclo todo e pulado. So entra em jogo quando ja houve uma sincronizacao
 * confirmada antes (`lastConfirmedRevision !== null`) - no primeiro sync
 * de todos nao ha nada para comparar, e o ciclo completo roda direto.
 */
import { getDeviceName } from '@/db/device.ts'
import { readLocalState, type LocalSyncSnapshot } from '@/db/syncRepo.ts'
import { getDB } from '@/db/schema.ts'
import { computeChecksum } from '@/domain/checksum.ts'
import { mergeState, type SyncableState } from '@/domain/merge.ts'
import { buildConflictCopies, detectNoteConflicts } from '@/domain/noteMerge.ts'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema.ts'
import { createStore } from '@/ui/store.ts'
import { callSync, type SyncErrorKind } from './client.ts'
import { getSyncToken, getSyncUrl, isSyncConfigured } from './config.ts'
import { applyAndConfirm, buildSummary } from './engineApply.ts'
import { isPayloadNearLimit } from './payloadSize.ts'

const MAX_CONFLICT_RETRIES = 3

export type SyncStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'not_configured' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'confirmed'; readonly at: string; readonly summary: string }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error'; readonly reason: SyncErrorKind | 'conflict_persisted' | 'schema_outdated' }

export const syncStatusStore = createStore<SyncStatus>({ kind: 'idle' })

/**
 * Aviso previo de payload grande (docs/prompt-anotacoes.md secao 6.3) -
 * atualizado a cada ciclo (mesmo no caminho rapido "nada para enviar"),
 * para a pessoa ver o aviso antes do push falhar de verdade. Store
 * separado do `syncStatusStore` porque e ortogonal ao resultado do ciclo -
 * um sync "Confirmado" pode estar perto do limite mesmo assim.
 */
export const payloadWarningStore = createStore<boolean>(false)

/**
 * Compatibilidade com o script antigo (docs/prompt-anotacoes.md secao
 * 1.6): detectado pela AUSENCIA de `capabilities.notes` na resposta de
 * `pull`/`ping` - um script publicado antes desta extensao simplesmente
 * nao conhece esse campo. Enquanto `notesSupported` for `false`, o ciclo
 * continua sincronizando tarefas normalmente, mas NUNCA envia nem recebe
 * anotacoes do servidor - elas ficam so locais, sempre marcadas pendentes,
 * ate a pessoa reimplantar o `Code.gs` novo (apps-script/README.md).
 */
export const scriptCapabilityStore = createStore<{ readonly notesSupported: boolean }>({
  notesSupported: true,
})

function remoteAsSyncable(data: {
  tasks: SyncableState['tasks']
  task_events: SyncableState['taskEvents']
  people: SyncableState['people']
  notes: SyncableState['notes']
}): SyncableState {
  return { tasks: data.tasks, taskEvents: data.task_events, people: data.people, notes: data.notes }
}

let syncInFlight: Promise<void> | null = null

/**
 * Dispara um ciclo de sync. Se um já estiver em andamento, devolve a MESMA
 * promise em vez de começar outro - o botão "Sincronizar agora", o atalho
 * `S` e o timer de 60s podem disparar quase ao mesmo tempo.
 */
export function runSync(): Promise<void> {
  syncInFlight ??= runSyncInternal().finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

/**
 * Verifica barato (so `status`) se vale a pena puxar o arquivo inteiro.
 * So pula o ciclo quando NAO ha nada pendente aqui E a revisao/checksum do
 * servidor sao exatamente os que este aparelho confirmou por ultimo - caso
 * contrario (primeiro sync, algo pendente, ou servidor mudou) o ciclo
 * completo decide por si so.
 */
async function skipBecauseNothingChanged(
  url: string,
  token: string,
  local: LocalSyncSnapshot,
): Promise<boolean> {
  if (local.pendingIds.length > 0) return false
  if (local.lastConfirmedRevision === null || local.lastConfirmedChecksum === null) return false

  const status = await callSync({ url, token, action: 'status' })
  // Erro de verdade (rede, token...): deixa o ciclo completo tratar.
  if (!status.ok) return false
  return status.revision === local.lastConfirmedRevision && status.checksum === local.lastConfirmedChecksum
}

async function runSyncInternal(): Promise<void> {
  if (!isSyncConfigured()) {
    syncStatusStore.set({ kind: 'not_configured' })
    return
  }
  if (!navigator.onLine) {
    syncStatusStore.set({ kind: 'offline' })
    return
  }

  syncStatusStore.set({ kind: 'syncing' })

  const db = getDB()
  const url = getSyncUrl()
  const token = getSyncToken()
  const device = getDeviceName()

  const localBeforeStatusCheck = await readLocalState(db)
  if (await skipBecauseNothingChanged(url, token, localBeforeStatusCheck)) {
    syncStatusStore.set({
      kind: 'confirmed',
      at: new Date().toISOString(),
      summary: 'Nada novo - nenhuma tarefa ou anotação mudou desde a última sincronização.',
    })
    return
  }

  for (let attempt = 1; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    const pulled = await callSync({ url, token, action: 'pull' })
    if (!pulled.ok) {
      syncStatusStore.set({ kind: 'error', reason: pulled.kind })
      return
    }
    if (!pulled.data) {
      syncStatusStore.set({ kind: 'error', reason: 'unexpected_response' })
      return
    }

    // Docs secao 6.1: um aparelho com app antigo que encontra uma revisao
    // gravada por uma versao mais nova do schema recusa sincronizar - sem
    // essa checagem, `mergeState` tentaria mesclar um objeto com campos que
    // esta versao do app nem conhece, arriscando descartar algo em
    // silencio no proximo push. So pode acontecer depois que ALGUM outro
    // aparelho ja sincronizou com uma versao mais nova deste app.
    if (pulled.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
      syncStatusStore.set({ kind: 'error', reason: 'schema_outdated' })
      return
    }

    // Compatibilidade com o script antigo (docs/prompt-anotacoes.md secao
    // 1.6): a AUSENCIA de `capabilities.notes` - nao um valor `false` - e
    // como um script publicado antes desta extensao se identifica, so por
    // nunca ter ouvido falar deste campo.
    const notesSupported = pulled.capabilities?.notes === true
    scriptCapabilityStore.set({ notesSupported })

    const remoteBefore = remoteAsSyncable(pulled.data)
    const local = await readLocalState(db)
    const now = new Date().toISOString()

    // Edicao concorrente genuina de anotacao (docs/prompt-anotacoes.md
    // secao 6.2): detectada ANTES da uniao generica, porque so aqui se
    // sabe quem e o "perdedor" que precisa virar copia - `mergeState`
    // sozinho so escolhe um vencedor e descartaria o outro texto. Num
    // script antigo `remoteBefore.notes` e sempre `[]` (a chave nem
    // existe na resposta), entao isto naturalmente nunca acha conflito -
    // nao precisa de um `if (notesSupported)` para isso especificamente.
    const conflicts = detectNoteConflicts(
      local.notes,
      remoteBefore.notes,
      local.pendingIds,
      local.lastConfirmedAt,
    )
    const merged = mergeState(local, remoteBefore, now)
    const conflictCopies = buildConflictCopies(conflicts, now, device, () => crypto.randomUUID())
    const mergedWithConflicts: SyncableState =
      conflictCopies.length === 0 ? merged : { ...merged, notes: [...merged.notes, ...conflictCopies] }

    payloadWarningStore.set(isPayloadNearLimit(mergedWithConflicts))

    // `includeNotes: notesSupported` - um script antigo calcula o checksum
    // SEM a chave `notes` (ver `apps-script/Code.gs` de antes desta
    // extensao); incluir anotacoes no calculo aqui faria o checksum nunca
    // bater com o que esse script devolve, mesmo sem nenhuma anotacao
    // ter mudado (ver `src/domain/checksum.ts`, `includeNotes`).
    const mergedChecksum = await computeChecksum(mergedWithConflicts, notesSupported)

    if (mergedChecksum === pulled.checksum) {
      // A mesclagem nao gerou diferenca em relacao ao servidor - nada para
      // empurrar (docs secao 6.1, passo 3). Ainda assim aplica local (pode
      // ter trazido mudanca de outro aparelho) e confirma.
      await applyAndConfirm(db, local, mergedWithConflicts, pulled.revision, pulled.checksum, notesSupported)
      syncStatusStore.set({
        kind: 'confirmed',
        at: now,
        summary: buildSummary(remoteBefore, local, mergedWithConflicts, conflicts.length),
      })
      return
    }

    const pushed = await callSync({
      url,
      token,
      action: 'push',
      baseRevision: pulled.revision,
      // `legacyPush` (so quando !notesSupported): omite a chave `notes`
      // do corpo de verdade enviado - nunca so `[]` - para o script
      // antigo nao gravar/calcular checksum sobre um campo que ele nem
      // sabe que existe (ver `src/sync/client.ts`).
      legacyPush: !notesSupported,
      data: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: [...mergedWithConflicts.tasks],
        task_events: [...mergedWithConflicts.taskEvents],
        people: [...mergedWithConflicts.people],
        notes: [...mergedWithConflicts.notes],
      },
    })

    if (!pushed.ok) {
      // Conflito: volta ao passo 1 (docs secao 6.1, passo 3).
      if (pushed.kind === 'conflict') continue
      syncStatusStore.set({ kind: 'error', reason: pushed.kind })
      return
    }

    // Verificacao (docs secao 6.1, passo 4): rele do script - nao confia so
    // na resposta do push - e recalcula o checksum A PARTIR do que releu,
    // comparando contra o checksum do estado que a pessoa pretendia gravar.
    const verify = await callSync({ url, token, action: 'pull' })
    if (!verify.ok) {
      syncStatusStore.set({ kind: 'error', reason: verify.kind })
      return
    }
    if (!verify.data) {
      syncStatusStore.set({ kind: 'error', reason: 'unexpected_response' })
      return
    }
    const verifyChecksum = await computeChecksum(remoteAsSyncable(verify.data), notesSupported)
    if (verifyChecksum !== mergedChecksum) {
      syncStatusStore.set({ kind: 'error', reason: 'unexpected_response' })
      return
    }

    await applyAndConfirm(db, local, mergedWithConflicts, pushed.revision, pushed.checksum, notesSupported)
    syncStatusStore.set({
      kind: 'confirmed',
      at: now,
      summary: buildSummary(remoteBefore, local, mergedWithConflicts, conflicts.length),
    })
    return
  }

  // 3 tentativas de conflito esgotadas (docs secao 6.1, passo 3 e secao 6.3).
  syncStatusStore.set({ kind: 'error', reason: 'conflict_persisted' })
}

/** Só para a tela de Configurações: "Testar conexão" sem tocar nos dados. */
export async function testConnection(url: string, token: string): Promise<SyncCallResultForTest> {
  const result = await callSync({ url, token, action: 'ping' })
  return result.ok ? { ok: true } : { ok: false, kind: result.kind }
}

export type SyncCallResultForTest = { readonly ok: true } | { readonly ok: false; readonly kind: SyncErrorKind }
