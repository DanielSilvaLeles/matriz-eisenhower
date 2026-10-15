/**
 * Unica porta de entrada de captura, de qualquer origem (docs secao 8):
 * digitada na caixa de entrada, colada em varias linhas, ou (fase 4)
 * compartilhada de outro app pelo share target do PWA.
 *
 * Interpreta o texto (divide em linhas, tira `#tag`) e grava cada linha como
 * um item novo na caixa de entrada. Uma linha que vira so tag, sem sobrar
 * titulo (ex.: colar so "#fornecedor"), e descartada - uma tarefa sem titulo
 * nao serve pra nada e so atrapalharia a triagem depois.
 */
import { getDB } from '@/db/schema.ts'
import { addTaskToInbox } from '@/db/tasksRepo.ts'
import { extractTags, splitCaptureLines } from '@/domain/capture.ts'
import type { Task, TaskSource } from '@/domain/schema.ts'

export interface CaptureInput {
  readonly text: string
  readonly source: TaskSource
}

export async function captureItem({ text, source }: CaptureInput): Promise<readonly Task[]> {
  const db = getDB()
  const lines = splitCaptureLines(text)
  const created: Task[] = []

  // Sequencial de proposito, nao Promise.all: cada insercao calcula "a
  // ultima posicao da caixa" a partir do que ja foi gravado, para a ordem
  // das linhas coladas virar a ordem de exibicao, sem ambiguidade de corrida.
  for (const line of lines) {
    const { title, tags } = extractTags(line)
    if (title === '') continue

    // eslint-disable-next-line no-await-in-loop -- ver nota acima: sequencial de proposito.
    const task = await addTaskToInbox(db, title, tags, source)
    created.push(task)
  }

  return created
}
