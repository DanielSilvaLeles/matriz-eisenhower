import { Download, Upload } from 'lucide-react'
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

function handleExport(): void {
  downloadBackup().catch((error: unknown) => {
    console.error('Falha ao exportar backup', error)
  })
}

/** Secao "Backup" das Configurações: exportar/importar com pré-visualização (docs secao 5.8). */
export function BackupSettings() {
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
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
    <section className="border-t border-border pt-4">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
        Backup
      </h3>
      <p className="mb-3 text-[11px] text-text-subtle">
        Rede de segurança: exporta ou restaura todos os dados num arquivo <code>.json</code>.
      </p>

      <button
        type="button"
        onClick={handleExport}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-text hover:bg-surface-muted"
      >
        <Download className="size-4" aria-hidden="true" />
        Exportar backup
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-text hover:bg-surface-muted"
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
          <p className="text-text-muted">Do backup: {countsLine(backupCounts(importState.backup))}</p>
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
    </section>
  )
}
