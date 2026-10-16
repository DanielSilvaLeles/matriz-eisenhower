/**
 * `discardEmptyNote` - separado de `notesRepo.ts` so pelo limite de
 * dependências do lint ao somar com o resto do editor. Mesmo espírito de
 * `discardTask` (`src/db/tasksRepo.ts`): apaga de vez, não é exclusão
 * lógica - usado só quando a anotação nunca teve conteúdo de verdade
 * (`docs/prompt-anotacoes.md` seção 5: "anotação vazia ao sair é
 * descartada em silêncio, sem lixo na lista").
 */
import { notifyLocalWrite } from './changeSignal.ts'
import { unmarkPendingInTx } from './metaRepo.ts'
import type { MatrizDB } from './schema.ts'

export function discardEmptyNote(db: MatrizDB, noteId: string): Promise<void> {
  notifyLocalWrite()
  return db.transaction('rw', db.notes, db.meta, async () => {
    await db.notes.delete(noteId)
    await unmarkPendingInTx(db, noteId)
  })
}
