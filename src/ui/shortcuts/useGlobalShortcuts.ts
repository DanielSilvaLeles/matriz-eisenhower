/**
 * Atalhos de teclado globais (docs secao 5.6): todos os que o documento
 * pede ja tem para onde ir a partir desta fase (`Enter` abre o painel de
 * detalhe, `T` abre a triagem).
 *
 * `Espaco` para concluir nao tem codigo aqui: a navegacao por seta leva o
 * foco ao proprio checkbox (ver data-task-anchor em TaskRow), e o navegador
 * ja ativa um checkbox focado com Espaco - reimplementar isso so duplicaria
 * o comportamento nativo.
 */
import { useEffect } from 'react'
import { getDB } from '@/db/schema.ts'
import { INBOX_CAPTURE_FIELD_ID } from '@/ui/components/CaptureField.tsx'
import type { QuadrantId } from '@/domain/quadrant.ts'
import { moveTaskWithUndo } from '@/ui/actions/moveTaskWithUndo.ts'
import { runSync } from '@/sync/engine.ts'
import { selectedTaskIdStore } from '@/ui/detail/store.ts'
import { helpOpenStore } from '@/ui/help/store.ts'
import { navigate as navigateToRoute } from '@/ui/router/store.ts'
import { triageOpenStore } from '@/ui/triage/store.ts'
import { undoPending } from '@/ui/undo/store.ts'

/**
 * Tipos de `<input>` que NAO sao digitacao de texto - um checkbox focado
 * (o proprio alvo da navegacao por seta, em TaskRow) nao pode contar como
 * "campo editavel", senao os atalhos 1-4/0 ficam bloqueados bem no lugar
 * onde mais precisam funcionar. So os tipos de verdade orientados a texto
 * devem suspender os atalhos.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'range',
  'color',
  'image',
])

/** Exportado para o modo triagem (TriageOverlay.tsx) reusar a mesma regra. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true
  if (!(target instanceof HTMLInputElement)) return false
  return !NON_TEXT_INPUT_TYPES.has(target.type)
}

/** Todos os "anchors" (um por tarefa) da mesma lista do elemento focado agora. */
function currentListAnchors(): readonly HTMLElement[] | undefined {
  const list = document.activeElement?.closest('[data-task-list]')
  if (!list) return undefined
  return Array.from(list.querySelectorAll<HTMLElement>('[data-task-anchor]'))
}

function navigate(direction: 1 | -1): boolean {
  const anchors = currentListAnchors()
  if (!anchors) return false

  const currentIndex = anchors.findIndex((anchor) => anchor === document.activeElement)
  if (currentIndex === -1) return false

  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), anchors.length - 1)
  anchors[nextIndex]?.focus()
  return true
}

function focusedTaskId(): string | undefined {
  const row = document.activeElement?.closest<HTMLElement>('[data-task-id]')
  return row?.dataset['taskId']
}

async function moveFocusedTaskTo(toQuadrant: QuadrantId | null): Promise<boolean> {
  const taskId = focusedTaskId()
  if (taskId === undefined) return false

  const task = await getDB().tasks.get(taskId)
  if (!task || task.quadrant === toQuadrant) return false

  await moveTaskWithUndo(task, toQuadrant)
  return true
}

const QUADRANT_BY_DIGIT: Record<string, QuadrantId> = { '1': 'q1', '2': 'q2', '3': 'q3', '4': 'q4' }

export function useGlobalShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const editing = isEditableTarget(event.target)

      // Ctrl+Z num campo de texto e o desfazer nativo do campo - tem que
      // ganhar do nosso. So intercepta fora de um campo editavel.
      if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undoPending().catch((error: unknown) => {
          console.error('Falha ao desfazer', error)
        })
        return
      }

      if (editing || event.ctrlKey || event.metaKey || event.altKey) return

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        document.querySelector<HTMLElement>(`#${INBOX_CAPTURE_FIELD_ID}`)?.focus()
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        helpOpenStore.set(true)
        return
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault()
        runSync().catch((error: unknown) => {
          console.error('Falha ao sincronizar', error)
        })
        return
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault()
        triageOpenStore.set(true)
        return
      }

      // Extensão "Anotações" (docs/prompt-anotacoes.md seção 3.2, desktop):
      // A nova anotação, L lista, / busca. So fazem sentido com teclado de
      // verdade (desktop) - no celular o menu inferior cobre a mesma acao,
      // mas nada aqui impede de funcionar la tambem se um teclado externo
      // estiver conectado.
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        navigateToRoute({ screen: 'note-editor', noteId: null })
        return
      }

      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault()
        navigateToRoute({ screen: 'notes-list' })
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        navigateToRoute({ screen: 'notes-list' })
        // A busca so existe depois da tela de anotacoes montar - espera o
        // proximo ciclo de render em vez de tentar focar algo que ainda
        // nao existe no DOM neste mesmo evento.
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>('#notes-search')?.focus()
        })
        return
      }

      if (event.key === 'Enter') {
        const taskId = focusedTaskId()
        if (taskId !== undefined) {
          event.preventDefault()
          selectedTaskIdStore.set(taskId)
        }
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        if (navigate(1)) event.preventDefault()
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        if (navigate(-1)) event.preventDefault()
        return
      }

      // Fora de campo editavel, digito solto nao tem acao padrao do
      // navegador para preservar - preveni na hora, nao depois do await
      // (so entao o preventDefault aconteceria tarde demais para valer).
      const quadrant = QUADRANT_BY_DIGIT[event.key]
      if (quadrant) {
        event.preventDefault()
        moveFocusedTaskTo(quadrant).catch((error: unknown) => {
          console.error('Falha ao mover a tarefa focada', error)
        })
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        moveFocusedTaskTo(null).catch((error: unknown) => {
          console.error('Falha ao mover a tarefa focada', error)
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
