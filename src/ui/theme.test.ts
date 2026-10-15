import { describe, expect, it } from 'vitest'
import {
  nextThemePreference,
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from './theme.ts'

describe('parseThemePreference', () => {
  it('aceita os tres valores validos', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('cai em "system" diante de lixo no armazenamento local', () => {
    for (const raw of [null, undefined, '', 'escuro', 42, {}, []]) {
      expect(parseThemePreference(raw)).toBe('system')
    }
  })
})

describe('resolveTheme', () => {
  it('respeita a escolha explicita, ignorando o sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('segue o sistema quando a preferencia e "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextThemePreference', () => {
  it('cicla claro -> escuro -> sistema -> claro', () => {
    expect(nextThemePreference('light')).toBe('dark')
    expect(nextThemePreference('dark')).toBe('system')
    expect(nextThemePreference('system')).toBe('light')
  })

  it('volta ao ponto de partida em tres cliques', () => {
    for (const start of ['light', 'dark', 'system'] satisfies ThemePreference[]) {
      const after3 = nextThemePreference(
        nextThemePreference(nextThemePreference(start)),
      )
      expect(after3).toBe(start)
    }
  })
})
