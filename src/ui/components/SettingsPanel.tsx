import { Dialog } from 'radix-ui'
import { Settings as SettingsIcon, X } from 'lucide-react'
import { useId, useState } from 'react'
import { getDeviceName, setDeviceName } from '@/db/device.ts'
import { cn } from '@/lib/utils.ts'
import { useTheme } from '@/ui/hooks/useTheme.ts'
import { nextThemePreference, THEME_LABELS, type ThemePreference } from '@/ui/theme.ts'
import { BackupSettings } from './BackupSettings.tsx'
import { ConnectionSettings } from './ConnectionSettings.tsx'

const THEME_OPTIONS: readonly ThemePreference[] = ['light', 'dark', 'system']

function ThemeSection() {
  const { preference, cycle } = useTheme()
  return (
    <div className="flex gap-1.5">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            // useTheme so expoe "cycle" (claro -> escuro -> sistema); clicar
            // numa opcao especifica avanca ate chegar nela - nunca mais de
            // 2 cliques, e nao duplica a logica de qual e a "proxima".
            let current = preference
            while (current !== option) current = nextThemePreference(current)
            if (current !== preference) cycle()
          }}
          aria-pressed={preference === option}
          className={cn(
            'flex-1 rounded-md border px-2 py-1.5 text-[13px]',
            preference === option
              ? 'border-focus bg-surface-muted font-medium text-text'
              : 'border-border text-text-muted hover:bg-surface-muted',
          )}
        >
          {THEME_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

/**
 * Tela de Configurações (docs secao 5.8): conexão de sync, nome do
 * aparelho, tema e backup - tudo num só painel, aberto pelo ícone de
 * engrenagem no cabeçalho.
 */
export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [deviceName, setDeviceNameState] = useState(getDeviceName)
  const deviceFieldId = useId()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
        >
          <SettingsIcon className="size-4" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-[15px] font-semibold text-text">
              Configurações
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <ConnectionSettings />

          <section className="mb-5 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
              Este aparelho
            </h3>
            <label htmlFor={deviceFieldId} className="mb-1 block text-xs text-text-muted">
              Nome (usado na mesclagem e no histórico)
            </label>
            <input
              id={deviceFieldId}
              type="text"
              value={deviceName}
              onChange={(event) => {
                setDeviceNameState(event.target.value)
                setDeviceName(event.target.value)
              }}
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text focus-visible:border-focus"
            />
          </section>

          <section className="mb-5 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
              Tema
            </h3>
            <ThemeSection />
          </section>

          <BackupSettings />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
