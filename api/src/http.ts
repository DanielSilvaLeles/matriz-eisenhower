/**
 * Rotas (todas sob `basePath`, `/matriz` por padrão):
 *
 *   GET  /health            sem chave - só "o processo e o banco respondem"
 *   GET  /v1/state          documento inteiro       (ações ping/pull)
 *   GET  /v1/state/status   só revision + checksum  (ação status)
 *   PUT  /v1/state          grava o documento       (ação push)
 *
 * Sucesso: `{ ok: true, revision, checksum, data? }`. Erro:
 * `{ ok: false, error }` com o mesmo vocabulário do Code.gs (`unauthorized`,
 * `conflict`, `invalid`, `busy`, `server`) mais `not_found`, e o status HTTP
 * correspondente - o proxy no Apps Script traduz de volta para o contrato
 * que o front já conhece.
 *
 * Sem CORS de propósito: nenhum navegador chama esta API, só o
 * `UrlFetchApp` do Apps Script (que não faz pré-voo nem olha cabeçalho
 * CORS). Sem `Access-Control-Allow-Origin`, um navegador qualquer que tente
 * chamar daqui não consegue ler a resposta.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from './config.ts'
import type { Pool } from './db.ts'
import { isRecord } from './json.ts'
import { pushDocument, readDocument, readStatus } from './state.ts'
import { parseSyncData } from './validate.ts'

type ErrorCode = 'unauthorized' | 'conflict' | 'invalid' | 'busy' | 'server' | 'not_found'

const STATUS_BY_ERROR: Record<ErrorCode, number> = {
  unauthorized: 401,
  conflict: 409,
  invalid: 422,
  busy: 503,
  server: 500,
  not_found: 404,
}

class HttpError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Compara pelos SHA-256 (tamanho fixo), não pelos textos - sem vazar por tempo. */
export function apiKeyMatches(received: string | undefined, expected: string): boolean {
  if (received === undefined || received === '') return false
  return timingSafeEqual(digest(received), digest(expected))
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(json)
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.length
    if (size > maxBytes) throw new HttpError('invalid', `corpo maior que ${maxBytes} bytes`)
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError('invalid', 'corpo não é JSON válido')
  }
}

async function route(req: IncomingMessage, config: Config, pool: Pool): Promise<{ status: number; body: unknown; note?: string }> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const prefix = config.basePath
  if (!url.pathname.startsWith(`${prefix}/`)) throw new HttpError('not_found', 'rota desconhecida')
  const pathname = url.pathname.slice(prefix.length)
  const method = req.method ?? 'GET'

  if (pathname === '/health' && method === 'GET') {
    try {
      await pool.query('SELECT 1')
      return { status: 200, body: { ok: true, db: 'up' } }
    } catch (error) {
      console.error(`[matriz-api] health: banco fora do ar: ${error instanceof Error ? error.message : String(error)}`)
      return { status: 503, body: { ok: false, db: 'down' } }
    }
  }

  const key = req.headers['x-api-key']
  if (!apiKeyMatches(typeof key === 'string' ? key : undefined, config.apiKey)) {
    throw new HttpError('unauthorized', 'X-Api-Key ausente ou inválida')
  }

  if (pathname === '/v1/state' && method === 'GET') {
    const doc = await readDocument(pool)
    return { status: 200, body: { ok: true, ...doc }, note: `rev=${doc.revision}` }
  }

  if (pathname === '/v1/state/status' && method === 'GET') {
    const status = await readStatus(pool)
    return { status: 200, body: { ok: true, ...status }, note: `rev=${status.revision}` }
  }

  if (pathname === '/v1/state' && method === 'PUT') {
    const body = await readJsonBody(req, config.maxBodyBytes)
    if (!isRecord(body)) throw new HttpError('invalid', 'corpo deve ser um objeto')
    const { baseRevision, data, allowShrink } = body
    if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new HttpError('invalid', 'baseRevision ausente ou inválido')
    }
    const parsed = parseSyncData(data)
    if (!parsed) throw new HttpError('invalid', 'data com formato inválido')

    const result = await pushDocument(pool, { baseRevision, data: parsed, allowShrink: allowShrink === true })
    if (!result.ok) throw new HttpError(result.error, `push recusado (base=${baseRevision})`)
    return { status: 200, body: result, note: `rev=${baseRevision}→${result.revision}` }
  }

  throw new HttpError('not_found', 'rota desconhecida')
}

export function createHandler(config: Config, pool: Pool) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = performance.now()
    let status = 500
    let note = ''
    try {
      const result = await route(req, config, pool)
      status = result.status
      note = result.note ?? ''
      send(res, status, result.body)
    } catch (error) {
      if (error instanceof HttpError) {
        status = STATUS_BY_ERROR[error.code]
        note = error.message
        send(res, status, { ok: false, error: error.code })
      } else {
        // Detalhe só no log (docker logs) - nunca na resposta.
        console.error('[matriz-api] erro inesperado:', error)
        status = 500
        send(res, status, { ok: false, error: 'server' })
      }
    } finally {
      // Uma linha por requisição - sem corpo, sem cabeçalhos, sem chave.
      const ms = Math.round(performance.now() - started)
      const line = `[matriz-api] ${req.method ?? '?'} ${(req.url ?? '').split('?')[0]} ${status} ${ms}ms${note ? ` ${note}` : ''}`
      if (status >= 500) console.error(line)
      else console.log(line)
    }
  }
}
