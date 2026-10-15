/**
 * Move uma tarefa (entre quadrantes, ou de volta para a caixa de entrada) e
 * registra o desfazer. E a unica porta por onde arrastar, os atalhos
 * `1`-`4`/`0` e o menu "Mover para" passam - os tres caminhos que o
 * documento pede como alternativas entre si (docs secao 4.5) tem que se
 * comportar exatamente igual, e centralizar aqui garante isso.
 */
import { getDB } from '@/db/schema.ts'
import { moveTaskToQuadrant, restoreTaskPlacement } from '@/db/tasksRepo.ts'
import { quadrantMeta, type QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { pushUndo } from '@/ui/undo/store.ts'

function destinationLabel(quadrant: QuadrantId | null): string {
  return quadrant === null ? 'Caixa de entrada' : quadrantMeta(quadrant).verb
}

export async function moveTaskWithUndo(task: Task, toQuadrant: QuadrantId | null): Promise<void> {
  const db = getDB()
  const fromQuadrant = task.quadrant
  const fromPosition = task.position

  const moved = await moveTaskToQuadrant(db, task.id, toQuadrant)

  pushUndo({
    id: moved.id,
    message: `"${moved.title}" movida para ${destinationLabel(toQuadrant)}. `,
    undo: async () => {
      await restoreTaskPlacement(db, moved.id, fromQuadrant, fromPosition)
    },
  })
}
