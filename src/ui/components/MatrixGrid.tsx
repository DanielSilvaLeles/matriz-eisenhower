import { quadrantMeta } from '@/domain/quadrant.ts'
import { QuadrantSection } from '@/ui/components/QuadrantSection.tsx'

const AXIS_LABEL = 'text-[11px] font-medium tracking-wide text-text-muted uppercase'

/**
 * A matriz e a home: abriu o site, esta nos quadrantes (docs secao 4.2).
 *
 * Layout canonico: as colunas sao a urgencia (esquerda urgente) e as linhas
 * sao a importancia (em cima importante). A grade ganha uma coluna e uma linha
 * extras para os rotulos dos eixos, que somem em tela estreita - a posicao
 * espacial dos quatro quadrantes continua a mesma, e e dela que a memoria
 * muscular depende.
 */
export function MatrixGrid() {
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3"
    >
      {/* Canto vazio: cruzamento dos dois eixos. */}
      <div className="hidden sm:block" aria-hidden="true" />
      <div className={`hidden justify-center pb-1 sm:flex ${AXIS_LABEL}`} aria-hidden="true">
        Urgente
      </div>
      <div className={`hidden justify-center pb-1 sm:flex ${AXIS_LABEL}`} aria-hidden="true">
        Não urgente
      </div>

      <div
        className={`hidden rotate-180 items-center justify-center pr-1 [writing-mode:vertical-rl] sm:flex ${AXIS_LABEL}`}
        aria-hidden="true"
      >
        Importante
      </div>
      <QuadrantSection quadrant={quadrantMeta('q1')} />
      <QuadrantSection quadrant={quadrantMeta('q2')} />

      <div
        className={`hidden rotate-180 items-center justify-center pr-1 [writing-mode:vertical-rl] sm:flex ${AXIS_LABEL}`}
        aria-hidden="true"
      >
        Não importante
      </div>
      <QuadrantSection quadrant={quadrantMeta('q3')} />
      <QuadrantSection quadrant={quadrantMeta('q4')} />
    </div>
  )
}
