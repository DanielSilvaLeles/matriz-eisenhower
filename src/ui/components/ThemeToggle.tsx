import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/ui/hooks/useTheme.ts'
import { THEME_LABELS, type ThemePreference } from '@/ui/theme.ts'

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeToggle() {
  const { preference, cycle } = useTheme()
  const Icon = ICONS[preference]

  return (
    <button
      type="button"
      onClick={cycle}
      // O rotulo diz o estado atual, nao o proximo: e o que o leitor de tela
      // precisa saber. O titulo repete para quem usa mouse.
      aria-label={THEME_LABELS[preference]}
      title={THEME_LABELS[preference]}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}
