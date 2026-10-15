import { useCallback, useEffect, useState } from 'react'
import {
  THEME_STORAGE_KEY,
  nextThemePreference,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/ui/theme.ts'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    // Navegacao privada ou armazenamento bloqueado: segue o sistema.
    return 'system'
  }
}

/**
 * Aplica a classe `.dark` no elemento raiz. O index.html faz o mesmo antes da
 * primeira pintura, para o tema escuro nao piscar branco no carregamento.
 */
function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export interface UseThemeResult {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** Avanca para o proximo tema do ciclo. */
  cycle: () => void
}

export function useTheme(): UseThemeResult {
  const [preference, setPreference] = useState<ThemePreference>(
    readStoredPreference,
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  )

  // O sistema pode trocar de tema com o app aberto (anoitecer, por exemplo).
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches)
    }
    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [])

  const resolved = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const cycle = useCallback(() => {
    setPreference((current) => {
      const next = nextThemePreference(current)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Sem armazenamento, o tema vale so para esta sessao.
      }
      return next
    })
  }, [])

  return { preference, resolved, cycle }
}
