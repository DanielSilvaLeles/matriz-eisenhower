/**
 * Alternar a estrela (ver `src/domain/favorite.ts`) de uma tarefa ou
 * anotação. Sem toast "Desfazer": é reversível na hora pelo próprio botão,
 * mesma leitura de concluir/reabrir pelo checkbox (CLAUDE.md, "Desfazer").
 */
import { setNoteFavoriteById } from '@/db/notesRepo.ts'
import { getDB } from '@/db/schema.ts'
import { editTaskFields } from '@/db/tasksRepo.lifecycle.ts'
import { isFavorite } from '@/domain/favorite.ts'
import type { Note, Task } from '@/domain/schema.ts'

export function toggleTaskFavorite(task: Task): void {
  editTaskFields(getDB(), task.id, { favorite: !isFavorite(task) }).catch((error: unknown) => {
    console.error('Falha ao favoritar a tarefa', error)
  })
}

export function toggleNoteFavorite(note: Note): void {
  setNoteFavoriteById(getDB(), note.id, !isFavorite(note)).catch((error: unknown) => {
    console.error('Falha ao favoritar a anotação', error)
  })
}
