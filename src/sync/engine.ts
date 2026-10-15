/**
 * Motor de sincronizacao (docs secao 6.1): pull -> mesclar -> push ->
 * verificacao. Um unico ciclo compartilhado por todos os gatilhos (abrir o
 * app, focar a aba, a cada 60s visivel, 3s apos editar, voltar a conexao,
 * botao/atalho "Sincronizar agora" - ver src/sync/triggers.ts) atraves de
 * `runSync()`, que de-duplica chamadas concorrentes.
 */
import { applyMergedState, readLocalState } from '@/db/syncRepo.ts'
import { clearPending } from '@/db/metaRepo.ts'
import { getDB } from '@/db/schema.ts'
import { computeChecksum } from '@/domain/checksum.ts'
import { mergeState, type SyncableState } from '@/domain/merge.ts'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema.ts'
import { createStore } from '@/ui/store.ts'
import { callSync, type SyncErrorKind } from './client.ts'
import { getSyncToken, getSyncUrl, isSyncConfigured } from './config.ts'

const MAX_CONFLICT_RETRIES = 3

export type SyncStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'not_configured' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'confirmed'; readonly at: string; readonly summary: string }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error'; readonly reason: SyncErrorKind | 'conflict_persisted' }

export const syncStatusStore = createStore<SyncStatus>({ kind: 'idle' })

function remoteAsSyncable(data: { tasks: SyncableState['tasks']; task_events: SyncableState['taskEvents']; people: SyncableState['people'] }): SyncableState {
  return { tasks: data.tasks, taskEvents: data.task_events, people: data.people }
}

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

function buildSummary(remoteBefore: SyncableState, local: SyncableState, merged: SyncableState): string {
  const sent = countChanged(remoteBefore.tasks, merged.tasks)
  const received = countChanged(local.tasks, merged.tasks)
  return `${pluralize(sent, 'enviada', 'enviadas')}, ${pluralize(received, 'recebida', 'recebidas')} de outro aparelho. Confirmado.`
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

  for (let attempt = 1; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    const pulled = await callSync({ url, token, action: 'pull' })
    if (!pulled.ok) {
      syncStatusStore.set({ kind: 'error', reason: pulled.kind })
      return
    }

    const remoteBefore = remoteAsSyncable(pulled.data)
    const local = await readLocalState(db)
    const now = new Date().toISOString()
    const merged = mergeState(local, remoteBefore, now)
    const mergedChecksum = await computeChecksum(merged)

    if (mergedChecksum === pulled.checksum) {
      // A mesclagem nao gerou diferenca em relacao ao servidor - nada para
      // empurrar (docs secao 6.1, passo 3). Ainda assim aplica local (pode
      // ter trazido mudanca de outro aparelho) e confirma.
      await applyMergedState(db, merged)
      await clearPending(db, pulled.revision, pulled.checksum, local.pendingIds)
      syncStatusStore.set({
        kind: 'confirmed',
        at: now,
        summary: buildSummary(remoteBefore, local, merged),
      })
      return
    }

    const pushed = await callSync({
      url,
      token,
      action: 'push',
      baseRevision: pulled.revision,
      data: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: [...merged.tasks],
        task_events: [...merged.taskEvents],
        people: [...merged.people],
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
    const verifyChecksum = await computeChecksum(remoteAsSyncable(verify.data))
    if (verifyChecksum !== mergedChecksum) {
      syncStatusStore.set({ kind: 'error', reason: 'unexpected_response' })
      return
    }

    await applyMergedState(db, merged)
    await clearPending(db, pushed.revision, pushed.checksum, local.pendingIds)
    syncStatusStore.set({
      kind: 'confirmed',
      at: now,
      summary: buildSummary(remoteBefore, local, merged),
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
