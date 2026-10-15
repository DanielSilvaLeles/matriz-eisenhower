import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { useInboxTasks, usePeopleNames } from '@/db/hooks.ts'
import { getDB } from '@/db/schema.ts'
import { moveTaskToQuadrant } from '@/db/tasksRepo.ts'
import { editTaskFields } from '@/db/tasksRepo.lifecycle.ts'
import { quadrantFor, type QuadrantId } from '@/domain/quadrant.ts'
import type { Task } from '@/domain/schema.ts'
import { isEditableTarget } from '@/ui/shortcuts/useGlobalShortcuts.ts'
import { useToday } from '@/ui/hooks/useNowTick.ts'
import { triageOpenStore } from './store.ts'
import { TriageDateStep, TriageDelegateStep } from './TriageFollowUpSteps.tsx'
import { TriageEditStep } from './TriageEditStep.tsx'
import { TriageHelpStep } from './TriageHelpStep.tsx'
import { TriageItemStep } from './TriageItemStep.tsx'

type Mode = 'item' | 'edit' | 'help' | 'date' | 'delegate'

const QUADRANT_BY_DIGIT: Record<string, QuadrantId> = { '1': 'q1', '2': 'q2', '3': 'q3', '4': 'q4' }

function closeTriage(): void {
  triageOpenStore.set(false)
}

async function sendToQuadrant(
  task: Task,
  quadrant: QuadrantId,
  onNeedsFollowUp: (mode: 'date' | 'delegate') => void,
  onDone: () => void,
): Promise<void> {
  await moveTaskToQuadrant(getDB(), task.id, quadrant)
  if (quadrant === 'q2') {
    onNeedsFollowUp('date')
    return
  }
  if (quadrant === 'q3') {
    onNeedsFollowUp('delegate')
    return
  }
  onDone()
}

/**
 * Modo triagem (docs secao 5.3): esvazia a caixa de entrada um item por
 * vez. Nao congela uma fila no momento de abrir - sempre processa o item
 * mais antigo (`useInboxTasks` ja ordena assim) que ainda nao foi pulado
 * nesta sessao; "pular" (tecla `S`) so adia, nao remove - a lista de
 * pulados reinicia quando a triagem fecha (ver a derivacao de estado
 * abaixo, no padrao recomendado pelo React para "resetar estado quando uma
 * prop muda" - sem useEffect).
 */
export function TriageOverlay() {
  const open = useSyncExternalStore(triageOpenStore.subscribe, triageOpenStore.get)
  const inboxTasks = useInboxTasks()
  const peopleNames = usePeopleNames()
  const today = useToday()

  const [wasOpen, setWasOpen] = useState(open)
  const [mode, setMode] = useState<Mode>('item')
  const [skipped, setSkipped] = useState<readonly string[]>([])
  // O objeto da tarefa em si (nao so o id): o passo de data/delegacao
  // precisa do titulo na hora, sem esperar uma releitura do banco (useTask)
  // que so resolveria depois do proximo render - exatamente quando esse
  // item e o ultimo da caixa, essa espera fazia a tela de "caixa zerada"
  // aparecer ANTES do passo de data, pulando-o inteiro (bug achado pelo
  // Playwright, nao pelo teste manual).
  const [pendingTask, setPendingTask] = useState<Task | null>(null)
  const [initialTotal, setInitialTotal] = useState(0)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setInitialTotal(inboxTasks.length)
      setSkipped([])
      setMode('item')
      setPendingTask(null)
    }
  }

  const current = inboxTasks.find((task) => !skipped.includes(task.id)) ?? inboxTasks[0]
  const done = Math.max(0, initialTotal - inboxTasks.length)
  const total = Math.max(initialTotal, inboxTasks.length)
  // `pendingTask` fica preenchido do instante em que uma movimentacao
  // comeca (handleDigit) até `finishStep` - inclusive durante os passos de
  // data/delegacao, que dependem dele. Enquanto isso, mode ainda pode estar
  // 'item' (a movimentacao e um ciclo assincrono do Dexie - ver CLAUDE.md);
  // sem essa trava, um segundo clique/tecla nesse intervalo capturava o
  // MESMO `current` (ainda nao saiu da caixa) e disparava uma segunda
  // movimentacao concorrente, cuja resolucao (que chega depois) sobrescrevia
  // o `mode`/`pendingTask` que a primeira tinha acabado de definir - o item
  // "voltava" e parecia que a triagem nao tinha feito nada.
  const busy = pendingTask !== null

  function finishStep(): void {
    setMode('item')
    setPendingTask(null)
  }

  function handleDigit(quadrant: QuadrantId): void {
    if (!current || busy) return
    const task = current
    setPendingTask(task)
    sendToQuadrant(task, quadrant, setMode, finishStep).catch((error: unknown) => {
      console.error('Falha ao mover a tarefa na triagem', error)
    })
  }

  function handleHelp(): void {
    if (busy) return
    setMode('help')
  }

  function handleEdit(): void {
    if (busy) return
    setMode('edit')
  }

  function handleSkip(): void {
    if (!current || busy) return
    setSkipped((prev) => [...prev, current.id])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (mode !== 'item' || !current || busy || isEditableTarget(event.target)) return

    const digit = QUADRANT_BY_DIGIT[event.key]
    if (digit) {
      event.preventDefault()
      event.stopPropagation()
      handleDigit(digit)
      return
    }
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault()
      event.stopPropagation()
      handleEdit()
      return
    }
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault()
      event.stopPropagation()
      handleSkip()
    }
  }

  function saveEdit(title: string): void {
    const trimmed = title.trim()
    if (current && trimmed !== '' && trimmed !== current.title) {
      editTaskFields(getDB(), current.id, { title: trimmed }).catch((error: unknown) => {
        console.error('Falha ao editar o titulo na triagem', error)
      })
    }
    setMode('item')
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeTriage()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <Dialog.Title className="text-[13px] font-semibold text-text">Triagem</Dialog.Title>
            <Dialog.Description className="sr-only">
              Classifique os itens da caixa de entrada, um por vez.
            </Dialog.Description>
            {total > 0 ? (
              <p className="text-xs text-text-muted tabular-nums">
                {done} de {total}
              </p>
            ) : null}
            <Dialog.Close
              aria-label="Fechar triagem (Esc)"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-4">
            {/*
             * Os passos de acompanhamento (data/delegacao) vem ANTES do
             * "caixa zerada": mover o ultimo item da caixa esvazia
             * `inboxTasks` no mesmo instante em que o passo abre - se a
             * checagem de "vazio" viesse primeiro, ela venceria e o passo
             * nunca apareceria para o ultimo item (bug encontrado pelo
             * Playwright - ver comentario em `pendingTask` acima).
             */}
            {mode === 'date' && pendingTask ? (
              <TriageDateStep
                taskTitle={pendingTask.title}
                today={today}
                onPick={(date) => {
                  editTaskFields(getDB(), pendingTask.id, { date })
                    .catch((error: unknown) => {
                      console.error('Falha ao definir a data na triagem', error)
                    })
                    .finally(finishStep)
                }}
                onSkip={finishStep}
              />
            ) : mode === 'delegate' && pendingTask ? (
              <TriageDelegateStep
                taskTitle={pendingTask.title}
                peopleNames={peopleNames}
                onPick={(name) => {
                  editTaskFields(getDB(), pendingTask.id, { delegated_to: name })
                    .catch((error: unknown) => {
                      console.error('Falha ao definir a delegação na triagem', error)
                    })
                    .finally(finishStep)
                }}
                onSkip={finishStep}
              />
            ) : mode === 'help' && current ? (
              <TriageHelpStep
                onCancel={() => {
                  setMode('item')
                }}
                onConfirm={(urgent, important) => {
                  handleDigit(quadrantFor(urgent, important))
                }}
              />
            ) : mode === 'edit' && current ? (
              <TriageEditStep initialTitle={current.title} onSave={saveEdit} />
            ) : current === undefined ? (
              <div className="text-center">
                <p className="text-lg font-semibold text-text">Caixa de entrada zerada! 🎉</p>
                <p className="mt-1 text-[13px] text-text-muted">Nada mais para triar agora.</p>
              </div>
            ) : (
              <TriageItemStep
                task={current}
                busy={busy}
                onSendToQuadrant={handleDigit}
                onHelp={handleHelp}
                onEdit={handleEdit}
                onSkip={handleSkip}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
