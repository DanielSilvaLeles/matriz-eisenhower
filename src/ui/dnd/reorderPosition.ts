/**
 * Calcula a nova posicao de uma tarefa ao ser solta perto de outra, dentro
 * da mesma lista (reordenar por arraste). Extraido do componente para ser
 * testavel sem precisar montar um DndContext inteiro.
 */
import { arrayMove } from '@dnd-kit/sortable'
import { positionBetween } from '@/domain/position.ts'
import type { Task } from '@/domain/schema.ts'

export function reorderPosition(list: readonly Task[], taskId: string, overTaskId: string): number {
  const ids = list.map((t) => t.id)
  const oldIndex = ids.indexOf(taskId)
  const overIndex = ids.indexOf(overTaskId)
  if (oldIndex === -1 || overIndex === -1) {
    return positionBetween(list.at(-1)?.position ?? null, null)
  }

  // arrayMove exige array mutavel; list pode vir de um hook readonly - uma
  // copia rasa resolve sem precisar mutar a lista de verdade.
  const reordered = arrayMove([...list], oldIndex, overIndex)
  const newIndex = reordered.findIndex((t) => t.id === taskId)
  const before = reordered[newIndex - 1]?.position ?? null
  const after = reordered[newIndex + 1]?.position ?? null
  return positionBetween(before, after)
}
