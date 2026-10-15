/**
 * Ids dos quatro quadrantes como zonas soltaveis do dnd-kit. Prefixados
 * para nunca colidir com o id (UUID) de uma tarefa sendo arrastada por cima
 * de outra - e assim que o fim do arraste distingue "soltou no quadrante
 * vazio" de "soltou em cima de uma tarefa" (ver src/ui/dnd/DndWorkspace.tsx).
 */
import { QUADRANTS, type QuadrantId } from '@/domain/quadrant.ts'

const PREFIX = 'container:'

export function quadrantContainerId(quadrant: QuadrantId): string {
  return `${PREFIX}${quadrant}`
}

function isQuadrantId(value: string): value is QuadrantId {
  return QUADRANTS.some((q) => q.id === value)
}

/** `undefined` quando o id nao e de um contentor de quadrante. */
export function parseQuadrantContainerId(id: string | number): QuadrantId | undefined {
  const raw = String(id)
  if (!raw.startsWith(PREFIX)) return undefined
  const candidate = raw.slice(PREFIX.length)
  return isQuadrantId(candidate) ? candidate : undefined
}
