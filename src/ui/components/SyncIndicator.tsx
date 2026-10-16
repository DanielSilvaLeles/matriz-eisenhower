import { AlertCircle, AlertTriangle, Check, CloudOff, RefreshCw } from 'lucide-react'
import { usePendingCount } from '@/db/hooks.ts'
import { runSync } from '@/sync/engine.ts'
import { SYNC_ERROR_MESSAGES } from '@/sync/errorMessages.ts'
import { usePayloadWarning } from '@/sync/usePayloadWarning.ts'
import { useScriptCapability } from '@/sync/useScriptCapability.ts'
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
 *
 * **`label` (o que aparece na barra) vs `detail` (o que aparece no
 * `title`, ao passar o mouse/segurar o dedo):** "Confirmado" é o único
 * estado com um resumo longo ("X enviadas, Y recebidas..."); mostrar esse
 * resumo inteiro na barra forçava o cabeçalho a quebrar linha nos
 * celulares comuns (feedback real do usuário: preferia a barra permanecer
 * numa linha só, com menos informação visível, a quebrar). O resumo
 * completo não desaparece - só sai da barra e vai para o `title`.
 */
export function SyncIndicator() {
  const status = useSyncStatus()
  const pendingCount = usePendingCount()
  const payloadNearLimit = usePayloadWarning()
  const { notesSupported } = useScriptCapability()

  const pendingLabel =
    pendingCount > 0
      ? `${pendingCount} ${pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}`
      : null

  let icon = <RefreshCw className="size-3.5" aria-hidden="true" />
  let label = 'Sincronização não configurada'
  let detail = label

  if (status.kind === 'syncing') {
    icon = <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
    label = 'Sincronizando…'
    detail = label
  } else if (status.kind === 'confirmed') {
    icon = <Check className="size-3.5 text-q1-ink" aria-hidden="true" />
    label = `Sincronizado às ${formatTime(status.at)}`
    detail = `${label} — ${status.summary}`
  } else if (status.kind === 'offline') {
    icon = <CloudOff className="size-3.5" aria-hidden="true" />
    label = 'Offline'
    detail = label
  } else if (status.kind === 'error') {
    icon = <AlertCircle className="size-3.5 text-q4-ink" aria-hidden="true" />
    label = `Erro: ${SYNC_ERROR_MESSAGES[status.reason]}`
    detail = label
  } else if (status.kind === 'idle' && pendingLabel !== null) {
    label = pendingLabel
    detail = label
  }

  return (
    <output
      className={cn(
        'flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs',
        status.kind === 'error' ? 'text-q4-ink' : 'text-text-muted',
      )}
    >
      {icon}
      <span className="max-w-28 truncate sm:max-w-none" title={detail}>
        {label}
      </span>
      {pendingLabel !== null && status.kind !== 'syncing' ? (
        <span
          data-pending-badge=""
          className="rounded-full bg-warn-soft px-1.5 text-warn tabular-nums"
        >
          {pendingCount}
        </span>
      ) : null}
      {notesSupported ? null : (
        <span
          title="Script desatualizado: reimplante a nova versão para sincronizar anotações."
          className="inline-flex shrink-0 items-center text-warn"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
        </span>
      )}
      {payloadNearLimit ? (
        <span
          title="Perto do limite de armazenamento do sync — considere exportar e arquivar anotações antigas."
          className="inline-flex shrink-0 items-center text-warn"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
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
