/**
 * Um unico DndContext cobrindo a matriz inteira e a caixa de entrada, porque
 * um arraste precisa cruzar de um quadrante para outro e da caixa de
 * entrada para um quadrante (docs secao 5.1). Resolve aqui, nao em cada
 * quadrante isolado, porque so aqui da pra saber "de qual lista saiu, em
 * qual lista entrou".
 *
 * So sensor de ponteiro (mouse e toque) - nao o de teclado do dnd-kit. A
 * alternativa por teclado e os atalhos 1-4/0 e o menu "Mover para"
 * (docs secao 4.5), que tem semantica propria; ligar os dois sistemas de
 * uma vez so causaria dois jeitos conflitantes de usar as setas.
 */
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { useInboxTasks, useOpenTasks } from '@/db/hooks.ts'
import { getDB } from '@/db/schema.ts'
import { reorderTaskPosition } from '@/db/tasksRepo.ts'
import { quadrantMeta, type QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { parseQuadrantContainerId } from './containers.ts'
import { reorderPosition } from './reorderPosition.ts'

/**
 * closestCorners compara o retangulo TRASLADADO do item arrastado (nao o
 * ponto do cursor) contra cada zona soltavel - pego pela alca, que fica na
 * borda do item de origem, o retangulo trasladado nao bate com "onde o
 * cursor esta visualmente", e o alvo resolvido surpreende. pointerWithin
 * verifica o ponto do cursor de verdade (e o que a pessoa espera: "solto
 * onde meu dedo/cursor esta"), com rectIntersection como reserva para o
 * raro caso de o cursor estar num vao entre duas zonas soltaveis.
 */
/**
 * pointerWithin primeiro (o ponto real do cursor, o que a pessoa espera:
 * "solto onde meu dedo/cursor esta"); rectIntersection so como reserva, para
 * o raro caso de o cursor estar bem no vao entre dois quadrantes, onde
 * pointerWithin nao bate com nenhum.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args)
}

function destinationName(quadrant: QuadrantId | null): string {
  return quadrant === null ? 'Caixa de entrada' : quadrantMeta(quadrant).verb
}

interface FoundTask {
  readonly task: Task
  readonly quadrant: QuadrantId | null
}

export interface DndWorkspaceProps {
  children: ReactNode
}

export function DndWorkspace({ children }: DndWorkspaceProps) {
  const [activeTask, setActiveTask] = useState<FoundTask | null>(null)

  const lists: Record<QuadrantId | 'inbox', readonly Task[]> = {
    q1: useOpenTasks('q1'),
    q2: useOpenTasks('q2'),
    q3: useOpenTasks('q3'),
    q4: useOpenTasks('q4'),
    inbox: useInboxTasks(),
  }

  function findTask(id: string): FoundTask | undefined {
    for (const key of ['q1', 'q2', 'q3', 'q4', 'inbox'] as const) {
      const task = lists[key].find((t) => t.id === id)
      if (task) return { task, quadrant: key === 'inbox' ? null : key }
    }
    return undefined
  }

  /** Quadrante de destino sob o ponteiro: direto (container) ou via a tarefa por baixo. */
  function resolveOverQuadrant(overId: string | number): QuadrantId | undefined {
    const container = parseQuadrantContainerId(overId)
    if (container !== undefined) return container
    return findTask(String(overId))?.quadrant ?? undefined
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const found = findTask(String(active.id))
      return found ? `Pegou "${found.task.title}", em ${destinationName(found.quadrant)}.` : undefined
    },
    onDragOver: ({ active, over }) => {
      if (!over) return undefined
      const found = findTask(String(active.id))
      const destination = resolveOverQuadrant(over.id)
      if (!found || destination === undefined) return undefined
      return `"${found.task.title}" sobre ${destinationName(destination)}.`
    },
    onDragEnd: ({ active, over }) => {
      const found = findTask(String(active.id))
      if (!found) return undefined
      if (!over) {
        return `Solto fora de um destino valido. "${found.task.title}" continua em ${destinationName(found.quadrant)}.`
      }
      const destination = resolveOverQuadrant(over.id)
      if (destination === undefined) return undefined
      return `"${found.task.title}" solta em ${destinationName(destination)}.`
    },
    onDragCancel: ({ active }) => {
      const found = findTask(String(active.id))
      return found
        ? `Arraste cancelado. "${found.task.title}" continua em ${destinationName(found.quadrant)}.`
        : undefined
    },
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(findTask(String(event.active.id)) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const found = findTask(String(active.id))
    if (!found) return
    const { task, quadrant: fromQuadrant } = found

    const toQuadrant = resolveOverQuadrant(over.id)
    if (toQuadrant === undefined) return

    const overTaskId = parseQuadrantContainerId(over.id) === undefined ? String(over.id) : undefined

    if (toQuadrant === fromQuadrant) {
      // Reordenar dentro da mesma lista: precisa de um alvo claro (outra
      // tarefa) para saber onde encaixar. Soltar no fundo vazio nao move nada.
      if (overTaskId === undefined || overTaskId === task.id) return
      const position = reorderPosition(lists[toQuadrant], task.id, overTaskId)
      const db = getDB()
      reorderTaskPosition(db, task.id, position).catch((error: unknown) => {
        console.error('Falha ao reordenar a tarefa', error)
      })
      return
    }

    // Entre quadrantes (ou da caixa de entrada): sempre no fim da lista de
    // destino, a mesma regra do atalho de teclado e do menu "Mover para" -
    // os tres caminhos tem que se comportar igual (docs secao 4.5).
    moveTaskWithUndo(task, toQuadrant).catch((error: unknown) => {
      console.error('Falha ao mover a tarefa', error)
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null)
      }}
    >
      {children}
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[13px] text-text shadow-lg">
            {activeTask.task.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
