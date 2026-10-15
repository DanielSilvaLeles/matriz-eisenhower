/**
 * Calculo de contraste WCAG 2.1. Usado pelo teste de tokens para garantir
 * o criterio de aceite "contraste AA em todos os elementos interativos".
 */

/** Luminancia relativa de um canal sRGB (WCAG 2.1, formula 1.4.3). */
function channelLuminance(value8bit: number): number {
  const c = value8bit / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Aceita `#rgb` e `#rrggbb`. */
export function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/u, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw

  if (!/^[0-9a-fA-F]{6}$/u.test(full)) {
    throw new Error(`Cor hexadecimal invalida: ${hex}`)
  }

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  )
}

/** Razao de contraste entre duas cores opacas, de 1 (igual) a 21 (preto/branco). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Texto normal precisa de 4.5:1 em AA. */
export const AA_TEXT = 4.5
/** Componente de interface e elemento grafico precisam de 3:1 em AA. */
export const AA_NON_TEXT = 3
