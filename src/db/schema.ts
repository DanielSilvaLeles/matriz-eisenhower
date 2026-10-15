/**
 * Banco local (IndexedDB via Dexie). E a fonte da verdade imediata do app -
 * toda leitura e escrita da interface passa por aqui, nunca pela rede
 * diretamente (docs secao 6: modelo local-first).
 *
 * Migrations versionadas: cada mudanca de formato soma uma `version()` nova
 * com `.upgrade()` explicando a transformacao. Nunca editar uma versao ja
 * publicada - sempre acrescentar a proxima.
 */
import DexieDB, { type EntityTable } from 'dexie'
import type { Meta, Person, Task, TaskEvent } from '@/domain/schema.ts'

export class MatrizDB extends DexieDB {
  tasks!: EntityTable<Task, 'id'>
  task_events!: EntityTable<TaskEvent, 'id'>
  people!: EntityTable<Person, 'id'>
  /**
   * Linha unica, chave fora da tabela (Dexie out-of-line key: o indice `''`
   * nao reserva um campo `id` dentro do objeto). Sempre lida e gravada pela
   * chave fixa `LOCAL_META_KEY`.
   */
  meta!: EntityTable<Meta>

  constructor(name: string) {
    super(name)

    // v1: formato inicial, igual ao `docs/prompt-matriz-eisenhower.md` secao 10,
    // com os ajustes de `position` (numero) e `date` (dia local) explicados
    // em src/domain/schema.ts.
    //
    // `[quadrant+status]` existe porque a leitura mais comum do app inteiro
    // e "tarefas abertas deste quadrante" - a grade principal faz essa
    // consulta para os quatro quadrantes toda vez que a tela renderiza.
    this.version(1).stores({
      tasks: 'id, quadrant, status, [quadrant+status], updated_at, deleted',
      task_events: 'id, task_id, at',
      people: 'id, name',
      meta: '',
    })
  }
}

export const LOCAL_META_KEY = 'local'

/** Nome do banco separado do de teste, para os dois nao colidirem. */
export const DB_NAME = 'matriz-eisenhower'

let instance: MatrizDB | null = null

/** Instancia unica do banco para a aplicacao real (lazy, para nao abrir em teste). */
export function getDB(): MatrizDB {
  instance ??= new MatrizDB(DB_NAME)
  return instance
}
