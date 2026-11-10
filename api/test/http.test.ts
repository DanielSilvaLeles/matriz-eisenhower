import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { computeChecksum } from '../src/checksum.ts'
import { loadConfig } from '../src/config.ts'
import type { Pool } from '../src/db.ts'
import { apiKeyMatches, createHandler } from '../src/http.ts'
import { doc, freshDatabase, skipWithoutDb, task, TEST_DATABASE_URL } from './helpers.ts'

const KEY = 'k'.repeat(48)

describe('configuração', () => {
  it('recusa subir sem chave ou com chave curta', () => {
    assert.throws(() => loadConfig({ DATABASE_URL: 'postgres://x' }), /MATRIZ_API_KEY/u)
    assert.throws(() => loadConfig({ DATABASE_URL: 'postgres://x', MATRIZ_API_KEY: 'curta' }), /MATRIZ_API_KEY/u)
    assert.throws(() => loadConfig({ MATRIZ_API_KEY: KEY }), /DATABASE_URL/u)
  })
  it('padrões: porta 5002, prefixo /matriz', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x', MATRIZ_API_KEY: KEY })
    assert.equal(config.port, 5002)
    assert.equal(config.basePath, '/matriz')
  })
  it('compara a chave sem aceitar vazio', () => {
    assert.equal(apiKeyMatches(KEY, KEY), true)
    assert.equal(apiKeyMatches(`${KEY}x`, KEY), false)
    assert.equal(apiKeyMatches('', KEY), false)
    assert.equal(apiKeyMatches(undefined, KEY), false)
  })
})

describe('HTTP', { skip: skipWithoutDb }, () => {
  let pool: Pool
  let server: Server
  let base: string

  before(async () => {
    pool = await freshDatabase()
    const config = loadConfig({ DATABASE_URL: TEST_DATABASE_URL, MATRIZ_API_KEY: KEY })
    const handler = createHandler(config, pool)
    server = createServer((req, res) => {
      void handler(req, res)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/matriz`
  })
  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve)
    })
    await pool.end()
  })

  const call = (path: string, init: RequestInit = {}, key: string | null = KEY) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(key === null ? {} : { 'X-Api-Key': key }) },
    })

  it('/health responde sem chave e sem dado nenhum', async () => {
    const res = await call('/health', {}, null)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true, db: 'up' })
  })

  it('sem chave ou chave errada → 401 em toda rota de dados', async () => {
    for (const key of [null, 'errada'.repeat(10)]) {
      const res = await call('/v1/state', {}, key)
      assert.equal(res.status, 401)
      assert.deepEqual(await res.json(), { ok: false, error: 'unauthorized' })
    }
  })

  it('nenhum cabeçalho CORS na resposta', async () => {
    const res = await call('/v1/state')
    assert.equal(res.headers.get('access-control-allow-origin'), null)
  })

  it('rota fora do prefixo ou desconhecida → 404', async () => {
    assert.equal((await fetch(base.replace('/matriz', '/outra/health'))).status, 404)
    assert.equal((await call('/v2/nada')).status, 404)
  })

  it('ciclo completo: status → pull → push → conflito → status', async () => {
    const empty = await (await call('/v1/state/status')).json()
    assert.deepEqual(empty, { ok: true, revision: 0, checksum: computeChecksum(doc()) })

    const data = doc({ tasks: [task({ favorite: true })] })
    const pushed = await call('/v1/state', { method: 'PUT', body: JSON.stringify({ baseRevision: 0, data }) })
    assert.equal(pushed.status, 200)
    const body = (await pushed.json()) as { ok: boolean; revision: number; checksum: string }
    assert.equal(body.revision, 1)
    assert.equal(body.checksum, computeChecksum(data))

    const conflict = await call('/v1/state', { method: 'PUT', body: JSON.stringify({ baseRevision: 0, data }) })
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), { ok: false, error: 'conflict' })

    const pulled = (await (await call('/v1/state')).json()) as { revision: number; data: unknown }
    assert.equal(pulled.revision, 1)
    assert.deepEqual(pulled.data, data)
  })

  it('payload malformado → 422 invalid', async () => {
    const bad = [
      'não é json',
      JSON.stringify({ data: doc() }),
      JSON.stringify({ baseRevision: 1, data: doc({ tasks: [task({ updated_at: '2026-10-15' })] }) }),
      JSON.stringify({ baseRevision: 1, data: doc({ tasks: [task({ id: 'ABCDEF00-0000-4000-8000-000000000001' })] }) }),
    ]
    for (const body of bad) {
      const res = await call('/v1/state', { method: 'PUT', body })
      assert.equal(res.status, 422, body.slice(0, 60))
      assert.deepEqual(await res.json(), { ok: false, error: 'invalid' })
    }
  })
})
