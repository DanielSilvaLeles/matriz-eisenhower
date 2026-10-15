// Harness de teste para apps-script/Code.gs: simula DriveApp, PropertiesService,
// LockService, Utilities, ContentService, MimeType e Logger em memoria, carrega
// o codigo real via vm, e exercita os fluxos principais antes de publicar de
// verdade no Google. Nao substitui testar no Apps Script real, mas pega bugs
// de logica (que Vitest nao alcança, por ser .gs) sem precisar de uma conta.
import vm from 'node:vm'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const source = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8')

// ---- Drive falso ----
class FakeFile {
  constructor(name, content) { this.name = name; this.content = content; this.trashed = false }
  getBlob() { return { getDataAsString: () => this.content } }
  setContent(c) { this.content = c }
  setName(n) { this.name = n }
  setTrashed(t) { this.trashed = t }
  makeCopy(newName, folder) {
    const copy = new FakeFile(newName, this.content)
    folder.files.push(copy)
    return copy
  }
}
class FakeFolder {
  constructor(name) { this.name = name; this.files = [] }
  getFilesByName(name) {
    const matches = this.files.filter(f => f.name === name && !f.trashed)
    let i = 0
    return { hasNext: () => i < matches.length, next: () => matches[i++] }
  }
  createFile(name, content) {
    const f = new FakeFile(name, content)
    this.files.push(f)
    return f
  }
}
const driveFolders = []
const DriveApp = {
  getFoldersByName(name) {
    const matches = driveFolders.filter(f => f.name === name)
    let i = 0
    return { hasNext: () => i < matches.length, next: () => matches[i++] }
  },
  createFolder(name) {
    const f = new FakeFolder(name)
    driveFolders.push(f)
    return f
  },
}

// ---- PropertiesService falso ----
const scriptProps = {}
const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (k in scriptProps ? scriptProps[k] : null),
    setProperty: (k, v) => { scriptProps[k] = v },
  }),
}

// ---- LockService falso (sem concorrencia real - so a API) ----
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) }

// ---- Utilities falso (getUuid + computeDigest de verdade via node:crypto) ----
let uuidCounter = 0
const Utilities = {
  getUuid: () => {
    uuidCounter++
    return `aaaaaaaa-bbbb-4ccc-8ddd-${String(uuidCounter).padStart(12, '0')}`
  },
  computeDigest: (algo, text) => {
    const hash = createHash('sha256').update(text, 'utf8').digest()
    // Simula bytes signed do Apps Script (Java-style int8)
    return Array.from(hash).map(b => (b > 127 ? b - 256 : b))
  },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
}

const ContentService = {
  MimeType: { JSON: 'JSON' },
  createTextOutput: (text) => ({
    _text: text,
    setMimeType() { return this },
  }),
}
const MimeType = { PLAIN_TEXT: 'PLAIN_TEXT' }
const Logger = { log: (msg) => console.log('[GAS LOG]', msg) }

const context = {
  DriveApp, PropertiesService, LockService, Utilities, ContentService, MimeType, Logger,
  console,
}
vm.createContext(context)
vm.runInContext(source, context, { filename: 'Code.gs' })

function call(name, ...args) {
  return context[name](...args)
}

function doPost(bodyObj) {
  const e = { postData: { contents: JSON.stringify(bodyObj) } }
  const result = call('doPost', e)
  return JSON.parse(result._text)
}

// ============ TESTES ============
let passed = 0, failed = 0
function check(desc, fn) {
  try { fn(); console.log('✓', desc); passed++ }
  catch (err) { console.log('✗', desc, '-', err.message); failed++ }
}

// 1. testChecksum roda e bate (mesma logica que o teste faz, so confirmando aqui tambem)
check('testChecksum() loga "Bate"', () => {
  const logs = []
  context.Logger.log = (m) => logs.push(m)
  call('testChecksum')
  context.Logger.log = Logger.log
  assert.ok(logs.some(l => l.includes('Bate')), 'esperava log de sucesso: ' + logs.join(' | '))
})

// 2. setupToken cria um token
let token
check('setupToken() cria um token de pelo menos 32 caracteres', () => {
  call('setupToken')
  token = scriptProps['MATRIZ_TOKEN']
  assert.ok(token && token.length >= 32, 'token invalido: ' + token)
})

check('setupToken() de novo lança erro (ja existe token)', () => {
  assert.throws(() => call('setupToken'))
})

// 3. ping sem token -> unauthorized
check('ping sem token da unauthorized', () => {
  const res = doPost({ action: 'ping', token: 'errado' })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'unauthorized')
})

check('ping com token certo da ok e revision 0 (banco vazio)', () => {
  const res = doPost({ action: 'ping', token })
  assert.equal(res.ok, true)
  assert.equal(res.revision, 0)
  assert.deepEqual(res.data.tasks, [])
})

// 4. pull banco vazio
check('pull banco vazio: revision 0, dados vazios, checksum presente', () => {
  const res = doPost({ action: 'pull', token })
  assert.equal(res.ok, true)
  assert.equal(res.revision, 0)
  assert.equal(typeof res.checksum, 'string')
  assert.equal(res.checksum.length, 64)
})

// 5. push invalido (sem baseRevision)
check('push sem baseRevision da invalid', () => {
  const res = doPost({ action: 'push', token, data: { schemaVersion: 1, tasks: [], task_events: [], people: [] } })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'invalid')
})

// 6. push valido, primeira vez
const sampleTask = {
  id: 't1', title: 'Revisar PR', notes: null, quadrant: 'q1', status: 'open',
  position: 1000, date: null, delegated_to: null, delegation_context: null,
  expected_outcome: null, tags: [], source: 'web', context: 'work',
  created_at: '2026-10-15T10:00:00.000Z', updated_at: '2026-10-15T10:00:00.000Z',
  completed_at: null, deleted: false, device: 'pc empresa',
}
let revisionAfterFirstPush
check('primeiro push com baseRevision 0 funciona e volta revision 1', () => {
  const res = doPost({
    action: 'push', token, baseRevision: 0,
    data: { schemaVersion: 1, tasks: [sampleTask], task_events: [], people: [] },
  })
  assert.equal(res.ok, true)
  assert.equal(res.revision, 1)
  revisionAfterFirstPush = res.revision
})

check('pull depois do push devolve a tarefa gravada', () => {
  const res = doPost({ action: 'pull', token })
  assert.equal(res.revision, 1)
  assert.equal(res.data.tasks.length, 1)
  assert.equal(res.data.tasks[0].id, 't1')
})

check('push com baseRevision desatualizado da conflict', () => {
  const res = doPost({
    action: 'push', token, baseRevision: 0, // devia ser 1 agora
    data: { schemaVersion: 1, tasks: [sampleTask], task_events: [], people: [] },
  })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'conflict')
})

// 7. shrink protection
check('push que reduz drasticamente sem allowShrink e recusado', () => {
  const manyTasks = []
  for (let i = 0; i < 10; i++) manyTasks.push({ ...sampleTask, id: 't' + i })
  doPost({
    action: 'push', token, baseRevision: revisionAfterFirstPush,
    data: { schemaVersion: 1, tasks: manyTasks, task_events: [], people: [] },
  })
  // agora o servidor tem 10 tarefas na revision 2; tenta reduzir para 1 sem allowShrink
  const res = doPost({
    action: 'push', token, baseRevision: 2,
    data: { schemaVersion: 1, tasks: [sampleTask], task_events: [], people: [] },
  })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'invalid')
})

check('o mesmo push com allowShrink:true e aceito', () => {
  const res = doPost({
    action: 'push', token, baseRevision: 2, allowShrink: true,
    data: { schemaVersion: 1, tasks: [sampleTask], task_events: [], people: [] },
  })
  assert.equal(res.ok, true)
  assert.equal(res.revision, 3)
})

check('push com tarefa invalida (status desconhecido) e recusado', () => {
  const res = doPost({
    action: 'push', token, baseRevision: 3,
    data: { schemaVersion: 1, tasks: [{ ...sampleTask, status: 'nao_existe' }], task_events: [], people: [] },
  })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'invalid')
})

check('checksum do pull bate com o calculo independente em Node', () => {
  const res = doPost({ action: 'pull', token })
  function sortKeysDeep(v) {
    if (Array.isArray(v)) return v.map(sortKeysDeep)
    if (v !== null && typeof v === 'object') {
      const s = {}
      Object.keys(v).sort().forEach(k => { if (v[k] !== undefined) s[k] = sortKeysDeep(v[k]) })
      return s
    }
    return v
  }
  const byId = (l) => [...l].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const payload = { tasks: byId(res.data.tasks), task_events: byId(res.data.task_events), people: byId(res.data.people) }
  const json = JSON.stringify(sortKeysDeep(payload))
  const expected = createHash('sha256').update(json, 'utf8').digest('hex')
  assert.equal(res.checksum, expected)
})

check('rotateToken troca o token e o antigo para de funcionar', () => {
  call('rotateToken')
  const newToken = scriptProps['MATRIZ_TOKEN']
  assert.notEqual(newToken, token)
  const res = doPost({ action: 'ping', token }) // token antigo
  assert.equal(res.ok, false)
  const res2 = doPost({ action: 'ping', token: newToken })
  assert.equal(res2.ok, true)
})

check('backups rotacionam: bak1 e bak2 existem depois de varios pushes', () => {
  const folder = driveFolders[0]
  const names = folder.files.map(f => f.name)
  assert.ok(names.includes('matriz.bak1.json'), 'faltou bak1: ' + names)
  assert.ok(names.includes('matriz.bak2.json'), 'faltou bak2: ' + names)
})

console.log(`\n${passed} passaram, ${failed} falharam`)
if (failed > 0) process.exit(1)
