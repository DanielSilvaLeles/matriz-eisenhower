/**
 * Importa o `matriz.json` do Drive (o envelope `{ revision, updatedAt, data }`
 * que o Code.gs grava) para o Postgres.
 *
 *   docker exec -i matriz-api node scripts/import.ts < matriz-beta.json
 *   docker exec -i matriz-api node scripts/import.ts --dry-run < matriz-beta.json
 *
 * - Idempotente: o banco fica IGUAL ao arquivo (upsert + remove o que não
 *   está nele), e a revisão do arquivo é preservada - rodar duas vezes com o
 *   mesmo arquivo não muda nada. Preservar a revisão é o que faz os
 *   aparelhos não verem conflito na virada.
 * - Recusa importar por cima de um banco que já está NA FRENTE do arquivo
 *   (revisão maior): depois da virada, o Postgres é a fonte, e reimportar o
 *   JSON antigo apagaria o que foi gravado desde então. `--force` passa por
 *   cima, de propósito e só à mão.
 * - Item sem `updated_at` recebe o próprio `created_at` (dado antigo).
 * - Relatório no fim: quantidade por entidade no arquivo vs. no banco, e o
 *   checksum dos dois lados.
 */
import { computeChecksum, type SyncData } from '../src/checksum.ts'
import { createPool } from '../src/db.ts'
import { isRecord } from '../src/json.ts'
import { migrate } from '../src/migrate.ts'
import { readDocument, replaceDocument } from '../src/state.ts'
import { parseSyncData } from '../src/validate.ts'

const ENTITY_NAMES = ['tasks', 'task_events', 'people', 'notes'] as const

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  return Buffer.concat(chunks).toString('utf8')
}

/** `updated_at` ausente → `created_at`. Devolve quantos itens foram preenchidos. */
function fillMissingUpdatedAt(data: Record<string, unknown>): number {
  let filled = 0
  for (const name of ENTITY_NAMES) {
    const list = data[name]
    if (!Array.isArray(list)) continue
    // Evento tem `at`, não `updated_at`.
    if (name === 'task_events') continue
    for (const item of list.filter((entry) => isRecord(entry))) {
      if ((item['updated_at'] === undefined || item['updated_at'] === null) && typeof item['created_at'] === 'string') {
        item['updated_at'] = item['created_at']
        filled += 1
      }
    }
  }
  return filled
}

function counts(data: SyncData): Record<string, number> {
  return Object.fromEntries(ENTITY_NAMES.map((name) => [name, data[name].length]))
}

async function main(): Promise<number> {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const force = args.has('--force')

  const url = process.env['DATABASE_URL'] ?? ''
  if (url === '') {
    console.error('DATABASE_URL ausente')
    return 1
  }

  const envelope: unknown = JSON.parse(await readStdin())
  if (!isRecord(envelope)) {
    console.error('arquivo não é um objeto JSON')
    return 1
  }
  const revision = envelope['revision']
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    console.error('arquivo sem `revision` válido - é mesmo o matriz.json do Drive (com o envelope)?')
    return 1
  }
  const rawData = envelope['data']
  if (!isRecord(rawData)) {
    console.error('arquivo sem `data`')
    return 1
  }
  const filled = fillMissingUpdatedAt(rawData)
  const data = parseSyncData(rawData)
  if (!data) {
    console.error('`data` não passou na validação (formato inesperado) - nada foi gravado')
    return 1
  }

  const pool = createPool(url)
  try {
    await migrate(pool)
    const before = await readDocument(pool)
    const dbHasData = ENTITY_NAMES.some((name) => before.data[name].length > 0)
    if (dbHasData && before.revision > revision && !force) {
      console.error(
        `o banco está na revisão ${before.revision}, À FRENTE do arquivo (${revision}) - ` +
          'importar apagaria o que foi gravado depois da virada. Nada foi feito. (--force passa por cima)',
      )
      return 1
    }

    const fileChecksum = computeChecksum(data)
    const after = dryRun ? null : await replaceDocument(pool, revision, data)

    const fileCounts = counts(data)
    const dbCounts = after ? counts(after.data) : counts(before.data)
    console.log(dryRun ? '\nSIMULAÇÃO (--dry-run): nada foi gravado\n' : '\nImportação concluída\n')
    console.log('entidade      arquivo   banco')
    for (const name of ENTITY_NAMES) {
      const mark = fileCounts[name] === dbCounts[name] ? '' : '   ← diferente'
      console.log(`${name.padEnd(12)}  ${String(fileCounts[name]).padStart(7)}  ${String(dbCounts[name]).padStart(6)}${mark}`)
    }
    const favorites = data.tasks.filter((t) => t['favorite'] === true).length + data.notes.filter((n) => n['favorite'] === true).length
    console.log(`\nfavoritas no arquivo: ${favorites}`)
    console.log(`updated_at preenchidos com created_at: ${filled}`)
    console.log(`revisão: arquivo ${revision}, banco ${after ? after.revision : before.revision}`)
    console.log(`checksum arquivo: ${fileChecksum}`)
    console.log(`checksum banco:   ${after ? after.checksum : before.checksum}`)
    if (after) {
      const ok = after.checksum === fileChecksum && ENTITY_NAMES.every((name) => fileCounts[name] === dbCounts[name])
      console.log(ok ? '\n✓ banco idêntico ao arquivo' : '\n✗ banco DIFERENTE do arquivo - não faça a virada')
      return ok ? 0 : 2
    }
    return 0
  } finally {
    await pool.end()
  }
}

process.exitCode = await main()
