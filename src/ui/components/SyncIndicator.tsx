import { AlertCircle, Check, CloudOff, RefreshCw } from 'lucide-react'
import { usePendingCount } from '@/db/hooks.ts'
import { runSync } from '@/sync/engine.ts'
import { SYNC_ERROR_MESSAGES } from '@/sync/errorMessages.ts'
import { useSyncStatus } from '@/sync/useSyncStatus.ts'
import { cn } from '@/lib/utils.ts'

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function handleSyncNow(): void {
  runSync().catch((error: unknown) => {
    console.error('Falha ao sincronizar', error)
  })
}

/**
 * Indicador sempre visivel no cabecalho (docs secao 6.3): os cinco estados
 * (sincronizado, sincronizando, pendencias, offline, erro) e o botao
 * "Sincronizar agora" (atalho `S`, ver useGlobalShortcuts.ts).
 */
export function SyncIndicator() {
  const status = useSyncStatus()
  const pendingCount = usePendingCount()

  const pendingLabel =
    pendingCount > 0
      ? `${pendingCount} ${pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}`
      : null

  let icon = <RefreshCw className="size-3.5" aria-hidden="true" />
  let label = 'Sincronização não configurada'

  if (status.kind === 'syncing') {
    icon = <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
    label = 'Sincronizando…'
  } else if (status.kind === 'confirmed') {
    icon = <Check className="size-3.5 text-q1-ink" aria-hidden="true" />
    label = `Sincronizado às ${formatTime(status.at)} — ${status.summary}`
  } else if (status.kind === 'offline') {
    icon = <CloudOff className="size-3.5" aria-hidden="true" />
    label = 'Offline'
  } else if (status.kind === 'error') {
    icon = <AlertCircle className="size-3.5 text-q4-ink" aria-hidden="true" />
    label = `Erro: ${SYNC_ERROR_MESSAGES[status.reason]}`
  } else if (status.kind === 'idle' && pendingLabel !== null) {
    label = pendingLabel
  }

  return (
    <output
      className={cn(
        'flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs',
        status.kind === 'error' ? 'text-q4-ink' : 'text-text-muted',
      )}
    >
      {icon}
      <span className="max-w-56 truncate sm:max-w-none" title={label}>
        {label}
      </span>
      {pendingLabel !== null && status.kind !== 'syncing' ? (
        <span className="rounded-full bg-warn-soft px-1.5 text-warn tabular-nums">
          {pendingCount}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleSyncNow}
        disabled={status.kind === 'syncing'}
        aria-label="Sincronizar agora"
        title="Sincronizar agora (S)"
        className="-mr-1 ml-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text disabled:opacity-50"
      >
        <RefreshCw className={cn('size-3.5', status.kind === 'syncing' && 'animate-spin')} aria-hidden="true" />
      </button>
    </output>
  )
}
