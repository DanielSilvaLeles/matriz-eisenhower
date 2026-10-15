import { Dialog } from 'radix-ui'
import { Database, Download, Upload, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { applyBackup, currentCounts, exportBackup, type ImportCounts } from '@/db/backup.ts'
import { getDB } from '@/db/schema.ts'
import { parseBackup, type Backup } from '@/domain/backup.ts'

type ImportState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'preview'; readonly backup: Backup; readonly before: ImportCounts }
  | { readonly phase: 'done' }

function countsLine(counts: ImportCounts): string {
  return `${counts.tasks} tarefas, ${counts.taskEvents} eventos, ${counts.people} pessoas`
}

function backupCounts(backup: Backup): ImportCounts {
  return {
    tasks: backup.tasks.length,
    taskEvents: backup.task_events.length,
    people: backup.people.length,
  }
}

async function downloadBackup(): Promise<void> {
  const backup = await exportBackup(getDB())
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const date = new Date().toISOString().slice(0, 10)
    const link = document.createElement('a')
    link.href = url
    link.download = `matriz-backup-${date}.json`
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Exportar e importar backup (docs secao 5.8): a rede de seguranca ate a
 * sincronizacao (fase 2) existir. Importar sempre mostra antes o que vai
 * ser substituido - nenhuma escrita acontece sem essa pre-visualizacao.
 */
function handleExport(): void {
  downloadBackup().catch((error: unknown) => {
    console.error('Falha ao exportar backup', error)
  })
}

export function BackupPanel() {
  const [open, setOpen] = useState(false)
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Limpa para o mesmo arquivo poder ser escolhido de novo depois (o
    // evento "change" nao dispara de novo para o mesmo valor senao).
    event.target.value = ''
    if (!file) return

    file
      .text()
      .then(async (text) => {
        const result = parseBackup(text)
        if (!result.ok) {
          setImportState({ phase: 'error', message: result.error })
          return
        }
        const before = await currentCounts(getDB())
        setImportState({ phase: 'preview', backup: result.backup, before })
      })
      .catch((error: unknown) => {
        console.error('Falha ao ler o arquivo', error)
        setImportState({ phase: 'error', message: 'Não deu para ler o arquivo.' })
      })
  }

  function handleConfirmImport() {
    if (importState.phase !== 'preview') return
    applyBackup(getDB(), importState.backup)
      .then(() => {
        setImportState({ phase: 'done' })
      })
      .catch((error: unknown) => {
        console.error('Falha ao importar backup', error)
        setImportState({ phase: 'error', message: 'Não deu para importar o backup.' })
      })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setImportState({ phase: 'idle' })
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Backup"
          title="Backup"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
        >
          <Database className="size-4" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <Dialog.Title className="text-[15px] font-semibold text-text">Backup</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-[13px] text-text-muted">
            Guarda todos os dados num arquivo <code>.json</code>. É a rede de segurança
            enquanto a sincronização entre aparelhos não existe.
          </Dialog.Description>

          <button
            type="button"
            onClick={handleExport}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-border-strong px-3 py-2 text-[13px] font-medium text-text hover:bg-surface-muted"
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar backup
          </button>

          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border-strong px-3 py-2 text-[13px] font-medium text-text hover:bg-surface-muted"
            >
              <Upload className="size-4" aria-hidden="true" />
              Importar backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileSelected}
              className="sr-only"
            />

            {importState.phase === 'error' ? (
              <p role="alert" className="mt-2 text-xs text-q4-ink">
                {importState.message}
              </p>
            ) : null}

            {importState.phase === 'preview' ? (
              <div className="mt-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-[13px]">
                <p className="font-medium text-text">Isto vai substituir os dados atuais:</p>
                <p className="mt-1 text-text-muted">Agora: {countsLine(importState.before)}</p>
                <p className="text-text-muted">
                  Do backup: {countsLine(backupCounts(importState.backup))}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="flex-1 rounded-md bg-q4 px-3 py-1.5 font-medium text-white hover:opacity-90"
                  >
                    Substituir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportState({ phase: 'idle' })
                    }}
                    className="flex-1 rounded-md border border-border-strong px-3 py-1.5 font-medium text-text hover:bg-surface-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {importState.phase === 'done' ? (
              <p className="mt-2 text-xs text-q1-ink">Backup importado.</p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
