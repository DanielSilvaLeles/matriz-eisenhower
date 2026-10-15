import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from './contrast.ts'

/**
 * Le tokens.css e verifica o contraste de cada par que aparece de verdade na
 * interface. Fonte unica da verdade: se alguem trocar uma cor no CSS e perder
 * AA, este teste reprova no CI - acessibilidade deixa de depender de lembrar.
 */

const css = readFileSync(
  fileURLToPath(new URL('./tokens.css', import.meta.url)),
  'utf8',
)

/**
 * Extrai os pares `--color-nome: #hex` de dentro de um bloco do CSS.
 * O seletor e ancorado no inicio da linha: `.dark` tambem aparece dentro do
 * `@custom-variant` no topo do arquivo, e nao e aquele bloco que queremos.
 */
function readPalette(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`Bloco nao encontrado: ${selector}`)

  const from = css.indexOf('{', start)
  const to = css.indexOf('\n}', from)
  const block = css.slice(from, to)

  const palette: Record<string, string> = {}
  for (const match of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,6})/gu)) {
    palette[match[1]!] = match[2]!
  }
  return palette
}

const themes = {
  claro: readPalette('@theme'),
  escuro: readPalette('.dark'),
}

const quadrants = ['q1', 'q2', 'q3', 'q4'] as const

/** [primeiro plano, fundo, minimo exigido, o que e na interface] */
type Check = [string, string, number, string]

const checks: Check[] = [
  // Texto neutro sobre os tres fundos onde ele aparece.
  ['text', 'surface', AA_TEXT, 'titulo da tarefa no cartao'],
  ['text', 'canvas', AA_TEXT, 'texto sobre o fundo da pagina'],
  ['text', 'surface-sunken', AA_TEXT, 'texto no quadrante recuado (Q4)'],
  ['text-muted', 'surface', AA_TEXT, 'linha de apoio do cabecalho'],
  ['text-muted', 'canvas', AA_TEXT, 'rotulos dos eixos da matriz'],
  ['text-muted', 'surface-sunken', AA_TEXT, 'apoio no quadrante recuado'],
  ['text-subtle', 'surface', AA_TEXT, 'tempo parado na caixa de entrada'],
  ['text-subtle', 'canvas', AA_TEXT, 'metadado sobre o fundo da pagina'],
  ['text-subtle', 'surface-sunken', AA_TEXT, 'estado vazio do quadrante recuado'],
  ['text-subtle', 'surface-muted', AA_TEXT, 'metadado em superficie secundaria'],

  // Aviso do contador (a partir de 8) e chip "sem data".
  ['warn', 'surface', AA_TEXT, 'contador em ambar'],
  ['warn', 'warn-soft', AA_TEXT, 'chip de aviso'],

  // Borda de controle e foco: componentes de interface, 3:1 basta.
  ['border-control', 'surface', AA_NON_TEXT, 'borda do campo e do checkbox'],
  ['border-control', 'surface-muted', AA_NON_TEXT, 'borda do campo em superficie secundaria'],
  ['border-control', 'surface-sunken', AA_NON_TEXT, 'borda do campo em Q4'],
  ['focus', 'surface', AA_NON_TEXT, 'anel de foco no cartao'],
  ['focus', 'canvas', AA_NON_TEXT, 'anel de foco sobre a pagina'],

  // Cada quadrante: ink e texto (4.5), a cor cheia e grafico (3).
  ...quadrants.flatMap((q): Check[] => [
    [`${q}-ink`, 'surface', AA_TEXT, `verbo da acao de ${q}`],
    [`${q}-ink`, `${q}-soft`, AA_TEXT, `verbo sobre o cabecalho tingido de ${q}`],
    [`${q}-ink`, 'canvas', AA_TEXT, `rotulo de ${q} sobre a pagina`],
    [q, 'surface', AA_NON_TEXT, `barra e ponto de ${q}`],
    [q, `${q}-soft`, AA_NON_TEXT, `ponto de ${q} sobre o cabeçalho tingido`],
  ]),
]

describe.each(Object.entries(themes))('tema %s', (themeName, palette) => {
  it('define todos os tokens de cor usados nas verificacoes', () => {
    const missing = checks
      .flatMap(([fg, bg]) => [fg, bg])
      .filter((token) => !(token in palette))
    expect([...new Set(missing)]).toEqual([])
  })

  it.each(checks)(
    '%s sobre %s >= %s:1 (%s)',
    (fg, bg, minimum, usage) => {
      const ratio = contrastRatio(palette[fg]!, palette[bg]!)
      expect(
        ratio,
        `tema ${themeName}: --color-${fg} (${palette[fg]}) sobre --color-${bg} ` +
          `(${palette[bg]}) deu ${ratio.toFixed(2)}:1, precisa de ${minimum}:1 - ${usage}`,
      ).toBeGreaterThanOrEqual(minimum)
    },
  )
})
