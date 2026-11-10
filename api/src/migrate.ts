/**
 * Migrations versionadas: `migrations/NNN_nome.sql`, aplicadas em ordem,
 * cada uma na própria transação, registradas em `schema_migrations`. Um
 * advisory lock impede duas instâncias (ex.: o container subindo duas vezes
 * num deploy) de aplicarem a mesma migration ao mesmo tempo.
 *
 * Roda sozinho no início do servidor (`server.ts`) e também à mão:
 * `docker exec matriz-api node src/migrate.ts`.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createPool, type Pool } from './db.ts'

const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', 'migrations')
// Arbitrário, só precisa ser estável entre execuções.
const ADVISORY_LOCK_KEY = 7_302_026

export async function migrate(pool: Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const done = new Set(
      (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    )
    const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/u.test(f)).toSorted()
    for (const file of files) {
      const version = file.slice(0, 3)
      if (done.has(version)) continue
      const sql = await readFile(path.join(dir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${file} falhou: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        })
      }
      applied.push(file)
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined)
    client.release()
  }
  return applied
}

if (import.meta.main) {
  const url = process.env['DATABASE_URL'] ?? ''
  if (url === '') {
    console.error('[matriz-api] DATABASE_URL ausente')
    process.exit(1)
  }
  const pool = createPool(url)
  try {
    const applied = await migrate(pool)
    console.log(applied.length > 0 ? `[matriz-api] migrations aplicadas: ${applied.join(', ')}` : '[matriz-api] schema em dia')
  } finally {
    await pool.end()
  }
}
