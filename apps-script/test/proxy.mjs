// Harness do modo proxy do Code.gs (MATRIZ_STORAGE = 'api'): o mesmo padrão
// de harness.mjs (Code.gs de verdade numa VM, globais do Apps Script
// simulados), mais um UrlFetchApp falso.
//
// Dois modos:
// - sempre: respostas da API roteirizadas por cenário (401, 409, HTML do
//   Cloudflare, exceção de rede...) - roda no CI, sem rede.
// - ponta a ponta, com PROXY_E2E_API_URL (ex.: http://127.0.0.1:55002/matriz)
//   e PROXY_E2E_API_KEY: o UrlFetchApp falso chama a API REAL por HTTP
//   (curl síncrono, porque UrlFetchApp é síncrono). Confere, entre outras
//   coisas, que o checksum que a API devolve é o mesmo que computeChecksum_
//   do próprio Code.gs calcula - a paridade das duas canonicalizações.
import vm from 'node:vm'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const source = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8')
const FAKE_API_URL = 'https://api.teste/matriz'
const FAKE_API_KEY = 'k'.repeat(64)

function createEnvironment(fetchImpl) {
  class FakeFile {
    constructor(name, content) { this.name = name; this.content = content; this.trashed = false }
    getBlob() { return { getDataAsString: () => this.content } }
    setContent(c) { this.content = c }
    setName(n) { this.name = n }
    setTrashed(t) { this.trashed = t }
    makeCopy(newName, folder) { return folder.createFile(newName, this.content) }
  }
  class FakeFolder {
    constructor(name) { this.name = name; this.files = [] }
    getFilesByName(name) {
      const matches = this.files.filter((f) => f.name === name && !f.trashed)
      let i = 0
      return { hasNext: () => i < matches.length, next: () => matches[i++] }
    }
    createFile(name, content) { const f = new FakeFile(name, content); this.files.push(f); return f }
  }
  const folders = []
  const props = {}
  const logs = []
  const fetchCalls = []
  const context = {
    DriveApp: {
      getFoldersByName(name) {
        const matches = folders.filter((f) => f.name === name)
        let i = 0
        return { hasNext: () => i < matches.length, next: () => matches[i++] }
      },
      createFolder(name) { const f = new FakeFolder(name); folders.push(f); return f },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_algo, text) =>
        Array.from(createHash('sha256').update(String(text), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: (text) => ({ _text: text, setMimeType() { return this } }) },
    MimeType: { PLAIN_TEXT: 'PLAIN_TEXT' },
    Logger: { log: (m) => logs.push(String(m)) },
    UrlFetchApp: {
      fetch(url, options) {
        fetchCalls.push({ url, options })
        return fetchImpl(url, options)
      },
    },
    console,
  }
  vm.createContext(context)
  vm.runInContext(source, context, { filename: 'Code.gs' })
  context.setupToken()
  const token = props.MATRIZ_TOKEN
  const doPost = (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ token, ...body }) } })._text)
  const configureApi = () => {
    props.MATRIZ_API_URL = FAKE_API_URL
    props.MATRIZ_API_KEY = FAKE_API_KEY
    props.MATRIZ_STORAGE = 'api'
  }
  return { context, props, logs, fetchCalls, folders, token, doPost, configureApi }
}

function response(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { getResponseCode: () => status, getContentText: () => text }
}

const sampleTask = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Revisar PR', notes: null, quadrant: 'q1', status: 'open',
  position: 1000, date: '2026-11-09', delegated_to: null, delegation_context: null, expected_outcome: null, tags: ['ação'],
  source: 'web', context: 'work', created_at: '2026-10-15T10:00:00.000Z', updated_at: '2026-10-15T10:00:00.000Z',
  completed_at: null, deleted: false, device: 'pc empresa', source_note_id: null, favorite: true,
}
const sampleNote = {
  id: '22222222-2222-4222-8222-222222222222', title: null, body: 'ata\n- [ ] item', tags: [], created_at: '2026-10-15T10:00:00.000Z',
  updated_at: '2026-10-15T10:00:00.000Z', deleted: false, deleted_at: null, device: 'celular', favorite: false,
}
const sampleData = { schemaVersion: 2, tasks: [sampleTask], task_events: [], people: [], notes: [sampleNote] }

let passed = 0
let failed = 0
function check(desc, fn) {
  try { fn(); console.log('✓', desc); passed++ } catch (err) { console.log('✗', desc, '-', err.message); failed++ }
}

// ============ Cenários roteirizados ============

check('sem MATRIZ_STORAGE o script continua no Drive e nunca chama a VPS', () => {
  const env = createEnvironment(() => { throw new Error('não devia chamar') })
  const res = env.doPost({ action: 'pull' })
  assert.equal(res.ok, true)
  assert.equal(env.fetchCalls.length, 0)
})

check('modo api sem URL/chave configuradas → server com mensagem clara', () => {
  const env = createEnvironment(() => { throw new Error('não devia chamar') })
  env.props.MATRIZ_STORAGE = 'api'
  const res = env.doPost({ action: 'pull' })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'server')
  assert.match(res.message, /MATRIZ_API_URL/)
})

check('token do front errado → unauthorized SEM chamar a VPS', () => {
  const env = createEnvironment(() => { throw new Error('não devia chamar') })
  env.configureApi()
  const res = JSON.parse(env.context.doPost({ postData: { contents: JSON.stringify({ token: 'x', action: 'pull' }) } })._text)
  assert.deepEqual(res, { ok: false, error: 'unauthorized' })
  assert.equal(env.fetchCalls.length, 0)
})

check('pull repassa os dados, manda X-Api-Key, muteHttpExceptions e sem seguir redirect', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 7, checksum: 'abc', data: sampleData }))
  env.configureApi()
  const res = env.doPost({ action: 'pull' })
  assert.equal(res.ok, true)
  assert.equal(res.revision, 7)
  assert.deepEqual(res.data, sampleData)
  assert.deepEqual(res.capabilities, { notes: true, status: true })
  const call = env.fetchCalls[0]
  assert.equal(call.url, `${FAKE_API_URL}/v1/state`)
  assert.equal(call.options.method, 'get')
  assert.equal(call.options.headers['X-Api-Key'], FAKE_API_KEY)
  assert.equal(call.options.muteHttpExceptions, true)
  assert.equal(call.options.followRedirects, false)
})

check('status vai para /v1/state/status e devolve sem data', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 7, checksum: 'abc' }))
  env.configureApi()
  const res = env.doPost({ action: 'status' })
  assert.deepEqual(res, { ok: true, revision: 7, checksum: 'abc', capabilities: { notes: true, status: true } })
  assert.equal(env.fetchCalls[0].url, `${FAKE_API_URL}/v1/state/status`)
})

check('push faz PUT com baseRevision/data/allowShrink em JSON', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 8, checksum: 'def', data: sampleData }))
  env.configureApi()
  const res = env.doPost({ action: 'push', baseRevision: 7, data: sampleData, allowShrink: true })
  assert.equal(res.ok, true)
  const call = env.fetchCalls[0]
  assert.equal(call.options.method, 'put')
  assert.equal(call.options.contentType, 'application/json')
  assert.deepEqual(JSON.parse(call.options.payload), { baseRevision: 7, data: sampleData, allowShrink: true })
})

check('push malformado → invalid SEM chamar a VPS', () => {
  const env = createEnvironment(() => { throw new Error('não devia chamar') })
  env.configureApi()
  assert.equal(env.doPost({ action: 'push', baseRevision: 1, data: { schemaVersion: 2 } }).error, 'invalid')
  assert.equal(env.fetchCalls.length, 0)
})

const mapped = [
  ['409 da API → conflict', 409, { ok: false, error: 'conflict' }, 'conflict', null],
  ['422 da API → invalid', 422, { ok: false, error: 'invalid' }, 'invalid', /recusou o pedido/],
  ['503 busy da API → busy', 503, { ok: false, error: 'busy' }, 'busy', /ocupada/],
  ['503 do health/banco → server', 503, { ok: false, db: 'down' }, 'server', /banco/],
  ['401 da API (chave errada no script) → server, não unauthorized', 401, { ok: false, error: 'unauthorized' }, 'server', /MATRIZ_API_KEY/],
  ['HTML do Cloudflare (403) → server citando Cloudflare', 403, '<!DOCTYPE html><title>Just a moment...</title>', 'server', /Cloudflare/],
  ['500 da API → server', 500, { ok: false, error: 'server' }, 'server', /HTTP 500/],
]
for (const [desc, status, body, error, message] of mapped) {
  check(desc, () => {
    const env = createEnvironment(() => response(status, body))
    env.configureApi()
    const res = env.doPost({ action: 'pull' })
    assert.equal(res.ok, false)
    assert.equal(res.error, error)
    if (message) assert.match(res.message, message)
    assert.ok(!JSON.stringify(res).includes(FAKE_API_KEY), 'a chave nunca vai na resposta')
  })
}

check('exceção de rede (DNS/timeout) → server com "VPS inacessível"', () => {
  const env = createEnvironment(() => { throw new Error('Address unavailable') })
  env.configureApi()
  const res = env.doPost({ action: 'pull' })
  assert.equal(res.error, 'server')
  assert.match(res.message, /VPS inacessível/)
})

check('resposta 200 com formato estranho → server, nunca repassa dado inválido', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 1, checksum: 'x', data: { tasks: 'nada' } }))
  env.configureApi()
  assert.equal(env.doPost({ action: 'pull' }).error, 'server')
})

check('trocar a flag vale na próxima requisição, sem recarregar o script', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 42, checksum: 'abc', data: sampleData }))
  env.configureApi()
  assert.equal(env.doPost({ action: 'pull' }).revision, 42)
  env.props.MATRIZ_STORAGE = 'drive'
  assert.equal(env.doPost({ action: 'pull' }).revision, 0)
})

check('usarApi recusa se a API estiver atrás do Drive (importação esquecida)', () => {
  let apiRevision = 0
  const env = createEnvironment((url) => {
    if (url.endsWith('/health')) return response(200, { ok: true, db: 'up' })
    return response(200, { ok: true, revision: apiRevision, checksum: 'abc' })
  })
  env.doPost({ action: 'push', baseRevision: 0, data: sampleData })
  env.doPost({ action: 'push', baseRevision: 1, data: sampleData })
  env.props.MATRIZ_API_URL = FAKE_API_URL
  env.props.MATRIZ_API_KEY = FAKE_API_KEY
  assert.throws(() => env.context.usarApi(), /atrás do Drive/)
  assert.equal(env.props.MATRIZ_STORAGE, undefined)
  apiRevision = 2
  env.context.usarApi()
  assert.equal(env.props.MATRIZ_STORAGE, 'api')
  const names = env.folders[0].files.filter((f) => !f.trashed).map((f) => f.name)
  assert.ok(names.includes('matriz.antes-da-api.json'), names.join(','))
})

check('usarApi recusa se a VPS não responder (/health com HTML)', () => {
  const env = createEnvironment(() => response(403, '<html>bloqueado</html>'))
  env.props.MATRIZ_API_URL = FAKE_API_URL
  env.props.MATRIZ_API_KEY = FAKE_API_KEY
  assert.throws(() => env.context.usarApi(), /continua no Drive/)
  assert.equal(env.props.MATRIZ_STORAGE, undefined)
})

check('voltarParaDrive copia o estado da API para o Drive com a revisão da API', () => {
  const env = createEnvironment(() => response(200, { ok: true, revision: 610, checksum: 'abc', data: sampleData }))
  env.configureApi()
  env.context.voltarParaDrive()
  assert.equal(env.props.MATRIZ_STORAGE, 'drive')
  const pulled = env.doPost({ action: 'pull' })
  assert.equal(pulled.revision, 610)
  assert.deepEqual(pulled.data.tasks, sampleData.tasks)
})

// ============ Ponta a ponta contra a API real (opcional) ============

const e2eUrl = process.env.PROXY_E2E_API_URL
const e2eKey = process.env.PROXY_E2E_API_KEY
if (e2eUrl && e2eKey) {
  // O Code.gs exige https; o UrlFetchApp falso troca o prefixo falso pela URL local real.
  const realFetch = (url, options) => {
    const target = url.replace(FAKE_API_URL, e2eUrl.replace(/\/+$/, ''))
    // UrlFetchApp usa GET quando `method` não vem (como no /health do testeVps).
    const args = ['-sS', '-X', (options.method || 'get').toUpperCase(), '-w', '\n%{http_code}']
    for (const [k, v] of Object.entries(options.headers || {})) args.push('-H', `${k}: ${v}`)
    if (options.payload !== undefined) args.push('-H', `Content-Type: ${options.contentType}`, '--data-binary', '@-')
    args.push(target)
    const out = execFileSync('curl', args, { input: options.payload ?? '', encoding: 'utf8' })
    const cut = out.lastIndexOf('\n')
    return response(Number(out.slice(cut + 1)), out.slice(0, cut))
  }

  check('E2E: ping → push → pull → conflito → status, com checksum da API = computeChecksum_ do Code.gs', () => {
    const env = createEnvironment(realFetch)
    env.props.MATRIZ_API_URL = FAKE_API_URL
    env.props.MATRIZ_API_KEY = e2eKey
    env.props.MATRIZ_STORAGE = 'api'
    const ping = env.doPost({ action: 'ping' })
    assert.equal(ping.ok, true, JSON.stringify(ping))

    const push = env.doPost({ action: 'push', baseRevision: ping.revision, data: sampleData, allowShrink: true })
    assert.equal(push.ok, true, JSON.stringify(push))
    assert.equal(push.revision, ping.revision + 1)
    assert.equal(push.checksum, env.context.computeChecksum_(sampleData), 'canonicalização API x Code.gs')

    const pull = env.doPost({ action: 'pull' })
    assert.deepEqual(pull.data.tasks, sampleData.tasks)
    assert.equal(pull.data.notes[0].favorite, false, 'favorite: false preservado')
    assert.equal(pull.checksum, env.context.computeChecksum_(pull.data))

    const stale = env.doPost({ action: 'push', baseRevision: ping.revision, data: sampleData })
    assert.deepEqual(stale, { ok: false, error: 'conflict' })

    const status = env.doPost({ action: 'status' })
    assert.equal(status.revision, push.revision)
    assert.equal(status.checksum, push.checksum)
  })

  check('E2E: testeVps loga ✓ contra a API real', () => {
    const env = createEnvironment(realFetch)
    env.props.MATRIZ_API_URL = FAKE_API_URL
    env.props.MATRIZ_API_KEY = e2eKey
    assert.equal(env.context.testeVps(), true, env.logs.join('\n'))
  })

  check('E2E: chave errada → server com mensagem da chave', () => {
    const env = createEnvironment(realFetch)
    env.props.MATRIZ_API_URL = FAKE_API_URL
    env.props.MATRIZ_API_KEY = 'z'.repeat(64)
    env.props.MATRIZ_STORAGE = 'api'
    const res = env.doPost({ action: 'pull' })
    assert.equal(res.error, 'server')
    assert.match(res.message, /MATRIZ_API_KEY/)
  })
} else {
  console.log('(ponta a ponta pulado: defina PROXY_E2E_API_URL e PROXY_E2E_API_KEY para rodar contra a API real)')
}

console.log(`\n${passed} passaram, ${failed} falharam`)
if (failed > 0) process.exit(1)
