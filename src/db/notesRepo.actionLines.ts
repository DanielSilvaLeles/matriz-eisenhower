/**
 * "De anotação para tarefa" (`docs/prompt-anotacoes.md` seção 5.1) -
 * separado de `notesRepo.ts` so pelo limite de classes por arquivo do
 * lint (mesmo arquivo lógico, mesma convenção de `tasksRepo.lifecycle.ts`
 * separar de `tasksRepo.ts`).
 */
import { extractActionLines, markActionLineSent } from '@/domain/actionLines.ts'
import { editNote } from '@/domain/note.ts'
import { positionBetween } from '@/domain/position.ts'
import type { Task } from '@/domain/schema.ts'
import { createTask } from '@/domain/task.ts'
import { notifyLocalWrite } from './changeSignal.ts'
import { getDeviceName } from './device.ts'
import { markPendingInTx } from './metaRepo.ts'
import { getNoteOrThrow, nowISO } from './notesRepo.ts'
import type { MatrizDB } from './schema.ts'
import { lastPosition, newId } from './tasksRepo.ts'

export class ActionLineNotFoundError extends Error {
  constructor(noteId: string, lineIndex: number) {
    super(`Linha de ação não encontrada ou já enviada: anotação ${noteId}, linha ${lineIndex}`)
  }
}

/**
 * Envia uma linha `[ ]`/`- [ ] ` para a caixa de entrada - cria a tarefa
 * com `source: 'note'` e `source_note_id` apontando para esta anotação, e
 * troca o marcador da linha por `[→]` na MESMA transação, para o estado
 * nunca ficar inconsistente entre "a tarefa já existe" e "a linha ainda
 * mostra o botão de enviar". Lança `ActionLineNotFoundError` se a linha já
 * tiver sido enviada ou não existir mais (evita duplicar sem a pessoa
 * pedir, mesmo que o índice de uma releitura antiga chegue atrasado).
 */
export function sendActionLineToInbox(
  db: MatrizDB,
  noteId: string,
  lineIndex: number,
  device: string = getDeviceName(),
): Promise<Task> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.tasks, db.task_events, db.meta, async () => {
    const note = await getNoteOrThrow(db, noteId)
    const line = extractActionLines(note.body).find((candidate) => candidate.lineIndex === lineIndex)
    if (!line || line.sent || line.text === '') throw new ActionLineNotFoundError(noteId, lineIndex)

    const now = nowISO()
    const position = positionBetween(await lastPosition(db, null), null)
    const { task, event } = createTask(
      {
        id: newId(),
        eventId: newId(),
        title: line.text,
        quadrant: null,
        position,
        device,
        source: 'note',
        sourceNoteId: note.id,
      },
      now,
    )
    await db.tasks.add(task)
    await db.task_events.add(event)
    await markPendingInTx(db, task.id)

    const updatedNote = editNote(note, { body: markActionLineSent(note.body, lineIndex) }, device, now)
    await db.notes.put(updatedNote)
    await markPendingInTx(db, updatedNote.id)

    return task
  })
}
