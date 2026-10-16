/**
 * Banco local (IndexedDB via Dexie). E a fonte da verdade imediata do app -
 * toda leitura e escrita da interface passa por aqui, nunca pela rede
 * diretamente (docs secao 6: modelo local-first).
 *
 * Migrations versionadas: cada mudanca de formato soma uma `version()` nova
 * com `.upgrade()` explicando a transformacao. Nunca editar uma versao ja
 * publicada - sempre acrescentar a proxima.
 */
import DexieDB, { type EntityTable, type Table } from 'dexie'
import type { Meta, Note, Person, Task, TaskEvent } from '@/domain/schema.ts'

export class MatrizDB extends DexieDB {
  tasks!: EntityTable<Task, 'id'>
  task_events!: EntityTable<TaskEvent, 'id'>
  people!: EntityTable<Person, 'id'>
  notes!: EntityTable<Note, 'id'>
  /**
   * Linha unica, chave fora da tabela (Dexie out-of-line key: o indice `''`
   * nao reserva um campo `id` dentro do objeto, `Meta` nao tem essa
   * propriedade). Por isso `Table<Meta, string>` em vez de `EntityTable`,
   * que so serve para chave embutida no objeto. Sempre lida e gravada pela
   * chave fixa `LOCAL_META_KEY`.
   */
  meta!: Table<Meta, string>

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

    // v2: extensão "Anotações" (`docs/prompt-anotacoes.md` seção 6.1) -
    // tabela `notes` nova e `tasks.source_note_id`. `.upgrade()` preenche
    // esse campo como `null` em toda tarefa já gravada - sem isso, uma
    // tarefa criada antes desta versão ficaria com o campo AUSENTE (não só
    // `null`), e `taskSchema` (Zod, obrigatório mesmo que nullable) rejeita
    // a leitura na primeira vez que o objeto passar por validação (backup,
    // sync). Teste de migração com fixture no formato v1 exato, provando
    // que tarefas/pessoas/histórico sobrevivem intactos:
    // `src/db/migration.test.ts`.
    //
    // `notes` indexada por `deleted` (lixeira de 30 dias, seção 5) e por
    // `created_at`/`updated_at` (ordenação padrão e "editada depois" da
    // lista, seção 4) - sem índice em `tags` ou no texto: a busca é local e
    // instantânea sobre o array inteiro em memória (volume esperado:
    // centenas por ano, não milhares), um índice ali só custaria escrita
    // sem ganhar nada de leitura.
    this.version(2)
      .stores({
        tasks: 'id, quadrant, status, [quadrant+status], updated_at, deleted',
        task_events: 'id, task_id, at',
        people: 'id, name',
        notes: 'id, deleted, created_at, updated_at',
        meta: '',
      })
      .upgrade(async (tx) => {
        await tx
          .table('tasks')
          .toCollection()
          .modify((task: Task) => {
            task.source_note_id = null
          })
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
