/**
 * Pool do Postgres. Único ajuste de tipo: `date` (OID 1082) volta como o
 * texto cru `YYYY-MM-DD`. O parser padrão do `pg` cria um `Date` à
 * meia-noite do fuso LOCAL do processo - o dia "Agendada para" podia voltar
 * como o dia anterior dependendo do TZ do container, e o checksum relido
 * nunca bateria. `timestamptz` fica com o parser padrão (`Date`), devolvido
 * com `toISOString()` em `entities.ts`.
 */
import { Pool as PgPool, types, type PoolClient as PgPoolClient } from 'pg'

types.setTypeParser(1082, (value: string) => value)

export type Pool = PgPool
export type PoolClient = PgPoolClient

export function createPool(connectionString: string): PgPool {
  const pool = new PgPool({ connectionString, max: 5, idleTimeoutMillis: 30_000 })
  // Sem este listener, uma conexão ociosa derrubada pelo servidor (restart
  // do container do Postgres, por exemplo) derrubaria o processo inteiro.
  pool.on('error', (error) => {
    console.error(`[matriz-api] conexão ociosa do pool caiu: ${error.message}`)
  })
  return pool
}

/** Erro do Postgres com `code` (SQLSTATE) - para classificar a falha. */
export function pgErrorCode(error: unknown): string | null {
  if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return null
}
