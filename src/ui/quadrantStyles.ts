import { Ban, CalendarClock, Forward, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { QuadrantId } from '@/domain/quadrant.ts'

/**
 * Estilo por quadrante, compartilhado entre QuadrantCard, TaskRow e qualquer
 * outro lugar que precise da cor de acento (o checkbox, por exemplo).
 *
 * Mapa estatico, e nao `bg-${id}` montado em tempo de execucao: o Tailwind
 * precisa ver a classe inteira escrita no codigo-fonte para gera-la no CSS.
 *
 * A cor entra so como acento - barra fina no topo, icone, um tom bem leve no
 * cabecalho e a cor do checkbox. O quadrante nunca e preenchido de cor
 * saturada (docs secao 7).
 */
export interface QuadrantStyle {
  readonly bar: string
  readonly ink: string
  readonly soft: string
  readonly accent: string
  readonly icon: LucideIcon
  readonly recessed: boolean
}

export const QUADRANT_STYLES: Record<QuadrantId, QuadrantStyle> = {
  q1: {
    bar: 'bg-q1',
    ink: 'text-q1-ink',
    soft: 'bg-q1-soft',
    accent: 'accent-q1',
    icon: Zap,
    recessed: false,
  },
  q2: {
    bar: 'bg-q2',
    ink: 'text-q2-ink',
    soft: 'bg-q2-soft',
    accent: 'accent-q2',
    icon: CalendarClock,
    recessed: false,
  },
  q3: {
    bar: 'bg-q3',
    ink: 'text-q3-ink',
    soft: 'bg-q3-soft',
    accent: 'accent-q3',
    icon: Forward,
    recessed: false,
  },
  // Q4 fica visualmente recuado para a hierarquia da tela refletir a
  // prioridade real: o que nao importa nem urge nao deve puxar o olho.
  // Recuar e afundar em direcao ao fundo da pagina, nos dois temas - por isso
  // surface-sunken, e nao surface-muted (que no tema escuro e mais claro que
  // a superficie normal e faria o Q4 saltar justamente ao contrario).
  q4: {
    bar: 'bg-q4',
    ink: 'text-q4-ink',
    soft: 'bg-q4-soft',
    accent: 'accent-q4',
    icon: Ban,
    recessed: true,
  },
}
