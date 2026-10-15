/**
 * Preferencia de tema: claro, escuro ou do sistema (docs secao 5.8).
 *
 * Logica pura e separada do React para poder ser testada e para ser reusada
 * pelo script do index.html que aplica o tema antes da primeira pintura.
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Guardado so no aparelho, como todo ajuste local. */
export const THEME_STORAGE_KEY = 'matriz:tema'

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system']

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Qualquer valor estranho no localStorage volta para "system". */
export function parseThemePreference(raw: unknown): ThemePreference {
  return isThemePreference(raw) ? raw : 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** Ciclo do botao: claro -> escuro -> sistema -> claro. */
export function nextThemePreference(
  current: ThemePreference,
): ThemePreference {
  const index = PREFERENCES.indexOf(current)
  return PREFERENCES[(index + 1) % PREFERENCES.length]!
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Tema claro',
  dark: 'Tema escuro',
  system: 'Tema do sistema',
}
