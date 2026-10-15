/**
 * Arquivamento automatico do Q4 na virada do dia (docs secao 5.4): "o item
 * fica visivel e esmaecido... e entao e arquivado automaticamente". Roda uma
 * vez ao abrir o app (ver App.tsx) - suficiente porque so importa o estado
 * na proxima vez que a pessoa olha a tela, nao o instante exato da meia-noite.
 */
import { hasDayChanged } from '@/domain/time.ts'
import { archiveTaskById } from './tasksRepo.lifecycle.ts'
import type { MatrizDB } from './schema.ts'

/** Quantas tarefas foram arquivadas - so para o teste confirmar o efeito. */
export async function archiveStaleQ4Tasks(db: MatrizDB, nowIso: string): Promise<number> {
  const q4Open = await db.tasks.where('[quadrant+status]').equals(['q4', 'open']).toArray()
  const stale = q4Open.filter((task) => hasDayChanged(task.updated_at, nowIso))

  // Sequencial de proposito (mesmo padrao de src/capture.ts): cada chamada e
  // a propria transacao de archiveTaskById, e Q4 tem no maximo ~10 tarefas
  // abertas por vez - nao ha ganho real em paralelizar.
  for (const task of stale) {
    // eslint-disable-next-line no-await-in-loop -- ver comentario acima.
    await archiveTaskById(db, task.id)
  }

  return stale.length
}
