/**
 * Matriz de Eisenhower — backend de sincronização (docs seção 6.4).
 *
 * Web App que roda como o dono do script, guardando um único arquivo
 * `matriz.json` numa pasta própria no Drive do dono. Sem Google Cloud, sem
 * OAuth no front, sem API do Drive via REST — só DriveApp/LockService/
 * PropertiesService nativos do Apps Script.
 *
 * Passo a passo de publicação e reimplantação: apps-script/README.md.
 * Depois de colar este arquivo, rode `setupToken` uma vez (menu Executar).
 *
 * Protocolo: tudo por POST, `Content-Type: text/plain`, corpo JSON —
 * `{ token, action: "ping"|"status"|"pull"|"push", baseRevision?, data?, allowShrink? }`.
 * Resposta sempre `{ ok: true, revision, checksum, data? }` ou
 * `{ ok: false, error: "unauthorized"|"conflict"|"invalid"|"busy"|"server" }`.
 * `data` fica ausente so na resposta de `status` (extensão "Anotações",
 * docs/prompt-anotacoes.md seção 6.3) — so revision+checksum, pra decidir
 * se vale puxar o arquivo inteiro, que so cresce com o volume de anotações.
 * O mesmo par de schemas vive em `src/domain/syncProtocol.ts` — qualquer
 * mudança aqui tem que ser espelhada lá, e vice-versa.
 */

// ───────────────────────── Configuração ─────────────────────────

/**
 * Nome da pasta e do arquivo de dados no Drive - vêm de propriedades do
 * script (`PropertiesService`), com os valores de PRODUÇÃO de sempre como
 * padrão (extensão "Anotações", docs/prompt-anotacoes.md seção 1.8: "build
 * para dois repositórios"). Uma cópia deste script publicada só para
 * testar o beta roda `setupBetaStorage()` (abaixo) UMA vez, antes de
 * qualquer sincronização, e passa a ler/escrever num arquivo totalmente
 * separado do de produção - sem editar nenhuma linha de código. Sem
 * nenhuma propriedade configurada (o caso de produção, hoje), o
 * comportamento é EXATAMENTE o mesmo de antes desta extensão existir.
 */
const FOLDER_NAME = PropertiesService.getScriptProperties().getProperty('MATRIZ_FOLDER_NAME') || 'Matriz de Eisenhower'
const DATA_FILE_NAME = PropertiesService.getScriptProperties().getProperty('MATRIZ_DATA_FILE_NAME') || 'matriz.json'
const BACKUP_1_NAME = DATA_FILE_NAME.replace(/\.json$/, '.bak1.json')
const BACKUP_2_NAME = DATA_FILE_NAME.replace(/\.json$/, '.bak2.json')
const TOKEN_PROPERTY_KEY = 'MATRIZ_TOKEN'
const SCHEMA_VERSION = 1

// 2 MB é generoso para as tarefas de uma única pessoa — acima disso é sinal
// de payload corrompido ou de ataque, não de uso legítimo.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024

// Recusa um push que reduza o número de tarefas para menos da metade do que
// o servidor já tem, a menos que `allowShrink` venha explícito — protege
// contra um aparelho com banco local vazio apagar tudo sem querer
// (docs seção 6.4). Em uso normal (pull → mesclar → push) isso nunca
// deveria disparar, porque a mesclagem é uma união: só cresce ou fica do
// mesmo tamanho, nunca encolhe sozinha.
const SHRINK_THRESHOLD = 0.5

/**
 * Extensão "Anotações" (docs/prompt-anotacoes.md seção 1.6):
 * "Compatibilidade com o script antigo" - o app novo pode estar falando
 * com uma cópia deste script publicada ANTES desta extensão existir, que
 * nem sabe que este campo deveria existir. `capabilities` vai em toda
 * resposta de sucesso (ping/status/pull/push) para o front **detectar**
 * isso: um script antigo simplesmente não devolve este campo (`undefined`
 * no front), nunca `{notes: false}` - a ausência É a informação. Enquanto
 * o script não for reimplantado com esta versão, o app continua
 * sincronizando tarefas normalmente e mantém anotações só locais, com um
 * aviso - nunca falha nem perde dado por essa diferença de versão.
 */
const CAPABILITIES = { notes: true, status: true }

// ───────────────────────── Ponto de entrada ─────────────────────────

function doPost(e) {
  try {
    const body = parseRequestBody_(e)
    if (!body) return respond_({ ok: false, error: 'invalid' })

    const parsed = parseAction_(body)
    if (!parsed) return respond_({ ok: false, error: 'invalid' })

    if (parsed.action === 'ping') return respond_(handlePing_(parsed))
    if (parsed.action === 'status') return respond_(handleStatus_(parsed))
    if (parsed.action === 'pull') return respond_(handlePull_(parsed))
    return respond_(handlePush_(parsed))
  } catch (error) {
    // Nunca vaza a mensagem do erro interno na resposta — podia revelar
    // algo sobre os dados ou a implementação. O detalhe fica só no log.
    Logger.log('Erro inesperado em doPost: ' + error)
    return respond_({ ok: false, error: 'server' })
  }
}

function respond_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

function parseRequestBody_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') return null
  if (e.postData.contents.length > MAX_PAYLOAD_BYTES) return null

  try {
    return JSON.parse(e.postData.contents)
  } catch (error) {
    return null
  }
}

/** Confere a forma básica do envelope e devolve só os campos usados. */
function parseAction_(body) {
  if (!body || typeof body.token !== 'string' || body.token.length === 0) return null
  if (
    body.action !== 'ping' &&
    body.action !== 'status' &&
    body.action !== 'pull' &&
    body.action !== 'push'
  ) {
    return null
  }

  return {
    token: body.token,
    action: body.action,
    baseRevision: body.baseRevision,
    data: body.data,
    allowShrink: body.allowShrink === true,
  }
}

// ───────────────────────── Ações ─────────────────────────

function handlePing_(request) {
  if (!checkToken_(request.token)) return { ok: false, error: 'unauthorized' }

  const state = readState_()
  return {
    ok: true,
    revision: state.revision,
    checksum: computeChecksum_(state.data),
    data: state.data,
    capabilities: CAPABILITIES,
  }
}

function handlePull_(request) {
  if (!checkToken_(request.token)) return { ok: false, error: 'unauthorized' }

  const state = readState_()
  return {
    ok: true,
    revision: state.revision,
    checksum: computeChecksum_(state.data),
    data: state.data,
    capabilities: CAPABILITIES,
  }
}

/**
 * Extensão "Anotações" (docs/prompt-anotacoes.md seção 6.3): so
 * revision+checksum, sem `data` - o app usa isto pra decidir se vale a
 * pena puxar o arquivo inteiro (que so cresce com o volume de anotações)
 * quando nada mudou desde a ultima sincronização confirmada.
 */
function handleStatus_(request) {
  if (!checkToken_(request.token)) return { ok: false, error: 'unauthorized' }

  const state = readState_()
  return {
    ok: true,
    revision: state.revision,
    checksum: computeChecksum_(state.data),
    capabilities: CAPABILITIES,
  }
}

function handlePush_(request) {
  if (!checkToken_(request.token)) return { ok: false, error: 'unauthorized' }

  if (typeof request.baseRevision !== 'number' || !isValidData_(request.data)) {
    return { ok: false, error: 'invalid' }
  }
  // Compatibilidade com o front antigo/modo legado (docs/prompt-anotacoes.md
  // secao 1.6): um push sem a chave `notes` (`legacyPush` no front, ou um
  // app anterior a esta extensão) e valido - normaliza para `[]` AQUI,
  // antes de qualquer uso de `request.data.notes` mais abaixo.
  normalizeData_(request.data)

  const lock = LockService.getScriptLock()
  let gotLock = false

  try {
    gotLock = lock.tryLock(10000)
    if (!gotLock) return { ok: false, error: 'busy' }

    // baseRevision é conferido AQUI DENTRO do lock, não antes — é isso que
    // impede duas gravações concorrentes de passarem na checagem ao mesmo
    // tempo (docs seção 6.4: "Conferir baseRevision dentro do lock").
    const folder = getOrCreateFolder_()
    const current = readStateFromFolder_(folder)

    if (current.revision !== request.baseRevision) {
      return { ok: false, error: 'conflict' }
    }

    if (!request.allowShrink && isDrasticShrink_(current.data, request.data)) {
      Logger.log(
        'Push recusado por encolher demais sem allowShrink. Atual: ' +
          current.data.tasks.length +
          ' tarefas/' +
          current.data.notes.length +
          ' anotações, novo: ' +
          request.data.tasks.length +
          ' tarefas/' +
          request.data.notes.length +
          ' anotações.',
      )
      return { ok: false, error: 'invalid' }
    }

    rotateBackups_(folder)

    const newRevision = current.revision + 1
    const newState = {
      revision: newRevision,
      updatedAt: new Date().toISOString(),
      data: request.data,
    }
    writeState_(folder, newState)

    return {
      ok: true,
      revision: newRevision,
      checksum: computeChecksum_(request.data),
      data: request.data,
      capabilities: CAPABILITIES,
    }
  } finally {
    if (gotLock) lock.releaseLock()
  }
}

// ───────────────────────── Token ─────────────────────────

/**
 * Rode uma vez (menu Executar → setupToken) depois de colar o código. O
 * valor aparece no log de execução — copie para a tela de Configurações do
 * app (docs seção 5.8). Para trocar depois, use `rotateToken`.
 */
function setupToken() {
  const props = PropertiesService.getScriptProperties()
  if (props.getProperty(TOKEN_PROPERTY_KEY)) {
    throw new Error('Já existe um token configurado. Use rotateToken() para trocar.')
  }
  const token = generateToken_()
  props.setProperty(TOKEN_PROPERTY_KEY, token)
  Logger.log('Token criado — copie para a tela de Configurações do app:\n' + token)
}

/** Troca o token (ex.: suspeita de vazamento). O antigo para de funcionar na hora. */
function rotateToken() {
  const props = PropertiesService.getScriptProperties()
  const token = generateToken_()
  props.setProperty(TOKEN_PROPERTY_KEY, token)
  Logger.log('Token rotacionado — copie o novo valor para a tela de Configurações:\n' + token)
}

/** Duas UUIDs concatenadas sem os hífens: 64 caracteres, bem acima do mínimo de 32. */
function generateToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).split('-').join('')
}

// ───────────────────────── Armazenamento (build para dois repositórios) ─────────────────────────

/**
 * Rode uma vez (menu Executar → setupBetaStorage), SÓ numa cópia deste
 * script publicada separadamente para testar o beta (nunca na cópia de
 * produção) - `apps-script/README.md` tem o passo a passo completo.
 * Depois de rodar, reimplante essa cópia (Implantar → Gerenciar
 * implantações → editar → Nova versão) para o `FOLDER_NAME`/
 * `DATA_FILE_NAME` novos valerem - eles são lidos uma vez só, no início de
 * cada execução do script.
 */
function setupBetaStorage() {
  const props = PropertiesService.getScriptProperties()
  props.setProperty('MATRIZ_FOLDER_NAME', 'Matriz de Eisenhower (beta)')
  props.setProperty('MATRIZ_DATA_FILE_NAME', 'matriz-beta.json')
  Logger.log(
    'Armazenamento do beta configurado - pasta "Matriz de Eisenhower (beta)", arquivo "matriz-beta.json". ' +
      'Reimplante esta cópia do script (Implantar → Gerenciar implantações → editar → Nova versão) para valer.',
  )
}

function checkToken_(token) {
  const stored = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY_KEY)
  if (!stored) return false
  return timingSafeEqual_(token, stored)
}

/**
 * Compara por tamanho fixo (o hash SHA-256 dos dois textos, sempre 32
 * bytes), não pelos textos originais — evita que o tempo de resposta varie
 * com QUANTOS caracteres do token bateram, que é o jeito clássico de um
 * atacante adivinhar um segredo byte a byte (docs seção 6.4: "Compare o
 * token sem vazar informação por diferença de tempo de resposta"). Não é
 * uma garantia matemática de tempo constante — Apps Script não expõe
 * primitivas de baixo nível para isso — mas elimina o vazamento óbvio de
 * comparar string contra string de tamanhos diferentes.
 */
function timingSafeEqual_(a, b) {
  const digestA = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(a),
    Utilities.Charset.UTF_8,
  )
  const digestB = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(b),
    Utilities.Charset.UTF_8,
  )
  let diff = 0
  for (let i = 0; i < digestA.length; i++) {
    diff |= digestA[i] ^ digestB[i]
  }
  return diff === 0
}

// ───────────────────────── Drive ─────────────────────────

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME)
  if (folders.hasNext()) return folders.next()
  return DriveApp.createFolder(FOLDER_NAME)
}

function getFileByName_(folder, name) {
  const files = folder.getFilesByName(name)
  return files.hasNext() ? files.next() : null
}

function emptyData_() {
  return { schemaVersion: SCHEMA_VERSION, tasks: [], task_events: [], people: [], notes: [] }
}

/**
 * Lê o estado atual. Se `matriz.json` ainda não existe (primeiro uso — a
 * pasta já foi criada por `getOrCreateFolder_`, mas o arquivo só nasce no
 * primeiro push de verdade), devolve um estado vazio na revisão 0, sem
 * gravar nada — não há por que criar um arquivo vazio só por causa de um
 * `pull` ou `ping`.
 */
function readState_() {
  return readStateFromFolder_(getOrCreateFolder_())
}

function readStateFromFolder_(folder) {
  const file = getFileByName_(folder, DATA_FILE_NAME)
  if (!file) return { revision: 0, updatedAt: null, data: emptyData_() }

  const content = file.getBlob().getDataAsString('UTF-8')
  const parsed = JSON.parse(content)
  return {
    revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
    updatedAt: parsed.updatedAt || null,
    data: isValidData_(parsed.data) ? normalizeData_(parsed.data) : emptyData_(),
  }
}

function writeState_(folder, state) {
  const content = JSON.stringify(state)
  const existing = getFileByName_(folder, DATA_FILE_NAME)
  if (existing) {
    existing.setContent(content)
  } else {
    folder.createFile(DATA_FILE_NAME, content, MimeType.PLAIN_TEXT)
  }
}

/**
 * Antes de sobrescrever `matriz.json`, empurra as cópias de segurança:
 * bak1 vira bak2 (o bak2 antigo vai para a lixeira) e o matriz.json atual
 * vira o novo bak1 — tudo isso antes de qualquer escrita no arquivo
 * principal, para uma gravação que falhe no meio nunca deixar as cópias de
 * segurança num estado pior do que estavam.
 */
function rotateBackups_(folder) {
  const current = getFileByName_(folder, DATA_FILE_NAME)
  if (!current) return // nada para rotacionar na primeira gravação

  const oldBak1 = getFileByName_(folder, BACKUP_1_NAME)
  if (oldBak1) {
    const oldBak2 = getFileByName_(folder, BACKUP_2_NAME)
    if (oldBak2) oldBak2.setTrashed(true)
    oldBak1.setName(BACKUP_2_NAME)
  }

  current.makeCopy(BACKUP_1_NAME, folder)
}

// ───────────────────────── Validação do payload ─────────────────────────

const QUADRANT_IDS = ['q1', 'q2', 'q3', 'q4']
const TASK_STATUSES = ['open', 'done', 'archived']
const TASK_SOURCES = ['web', 'pwa', 'share', 'note']
const TASK_CONTEXTS = ['work', 'personal']
const TASK_EVENT_TYPES = ['created', 'moved', 'completed', 'reopened', 'archived']

function isNonEmptyString_(value) {
  return typeof value === 'string' && value.length > 0
}

function isNullOr_(value, check) {
  return value === null || check(value)
}

function includes_(list, value) {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) return true
  }
  return false
}

/**
 * Checagem estrutural, não uma reimplementação completa do Zod do front
 * (`src/domain/schema.ts`) — confere os campos que, se errados, corrompem
 * a mesclagem ou a exibição (tipos, enums, id/título não vazios). Não
 * valida every refinamento (tamanho máximo de string, por exemplo): o
 * Apps Script é a última linha de defesa contra payload malformado, não a
 * fonte da verdade do formato.
 */
function isValidTask_(task) {
  return (
    task &&
    typeof task === 'object' &&
    isNonEmptyString_(task.id) &&
    isNonEmptyString_(task.title) &&
    isNullOr_(task.quadrant, (v) => includes_(QUADRANT_IDS, v)) &&
    includes_(TASK_STATUSES, task.status) &&
    typeof task.position === 'number' &&
    includes_(TASK_SOURCES, task.source) &&
    includes_(TASK_CONTEXTS, task.context) &&
    isNonEmptyString_(task.created_at) &&
    isNonEmptyString_(task.updated_at) &&
    typeof task.deleted === 'boolean' &&
    isNonEmptyString_(task.device) &&
    Array.isArray(task.tags) &&
    // Extensão "Anotações": aponta para notes.id quando a tarefa nasceu do
    // envio de uma linha de ação de dentro de uma anotação - null no resto.
    // `undefined` também é aceito (não só `null`): uma tarefa gravada por um
    // front mais antigo, de antes deste campo existir, nunca vai mandar essa
    // chave - compatibilidade na direção contrária da seção 1.6 do prompt
    // (lá é "front novo + script antigo"; aqui, pela mesma cautela, também
    // "script novo + payload antigo" não quebra).
    (task.source_note_id === undefined || isNullOr_(task.source_note_id, isNonEmptyString_))
  )
}

function isValidTaskEvent_(event) {
  return (
    event &&
    typeof event === 'object' &&
    isNonEmptyString_(event.id) &&
    isNonEmptyString_(event.task_id) &&
    includes_(TASK_EVENT_TYPES, event.type) &&
    isNullOr_(event.from_quadrant, (v) => includes_(QUADRANT_IDS, v)) &&
    isNullOr_(event.to_quadrant, (v) => includes_(QUADRANT_IDS, v)) &&
    isNonEmptyString_(event.at) &&
    isNonEmptyString_(event.device)
  )
}

function isValidPerson_(person) {
  return (
    person &&
    typeof person === 'object' &&
    isNonEmptyString_(person.id) &&
    isNonEmptyString_(person.name) &&
    isNonEmptyString_(person.updated_at)
  )
}

/**
 * Extensão "Anotações" (docs/prompt-anotacoes.md seção 6.1/6.2) - mesmo
 * espírito de `isValidTask_`: confere so os campos que corrompem a
 * mesclagem ou a exibição, não todo refinamento do Zod do front.
 */
function isValidNote_(note) {
  return (
    note &&
    typeof note === 'object' &&
    isNonEmptyString_(note.id) &&
    isNullOr_(note.title, isNonEmptyString_) &&
    typeof note.body === 'string' &&
    Array.isArray(note.tags) &&
    isNonEmptyString_(note.created_at) &&
    isNonEmptyString_(note.updated_at) &&
    typeof note.deleted === 'boolean' &&
    isNullOr_(note.deleted_at, isNonEmptyString_) &&
    isNonEmptyString_(note.device)
  )
}

/**
 * `data.notes` pode faltar por completo - não só vir `[]` - num arquivo
 * `matriz.json` gravado por uma versão deste script ANTERIOR a esta
 * extensão (docs/prompt-anotacoes.md seção 1.6). Tolerar isso aqui é
 * essencial: sem essa tolerância, `isValidData_` rejeitaria o arquivo
 * EXISTENTE inteiro na primeira leitura depois de reimplantar, e
 * `readStateFromFolder_` cairia para `emptyData_()` - apagando tarefas de
 * verdade da tela (não do Drive, mas o suficiente para parecer que tudo
 * desapareceu). `normalizeData_` (chamado só depois de validar) é quem
 * de fato preenche `notes: []` para o resto do script nunca precisar
 * checar essa ausência de novo.
 */
function isValidData_(data) {
  if (!data || typeof data !== 'object') return false
  if (typeof data.schemaVersion !== 'number') return false
  if (!Array.isArray(data.tasks) || !Array.isArray(data.task_events) || !Array.isArray(data.people)) {
    return false
  }
  if (data.notes !== undefined && !Array.isArray(data.notes)) return false
  for (let i = 0; i < data.tasks.length; i++) {
    if (!isValidTask_(data.tasks[i])) return false
  }
  for (let j = 0; j < data.task_events.length; j++) {
    if (!isValidTaskEvent_(data.task_events[j])) return false
  }
  for (let k = 0; k < data.people.length; k++) {
    if (!isValidPerson_(data.people[k])) return false
  }
  if (Array.isArray(data.notes)) {
    for (let m = 0; m < data.notes.length; m++) {
      if (!isValidNote_(data.notes[m])) return false
    }
  }
  return true
}

/** So chamar depois de `isValidData_` aprovar - garante `notes` sempre array. */
function normalizeData_(data) {
  if (!Array.isArray(data.notes)) data.notes = []
  return data
}

/**
 * Protege contra encolhimento brusco tanto de tarefas quanto de anotações
 * (docs/prompt-anotacoes.md seção 6.3: "O Apps Script continua protegendo
 * contra encolhimento brusco também para anotações") - qualquer uma das
 * duas encolhendo demais sem `allowShrink` recusa o push.
 */
function isDrasticShrink_(currentData, newData) {
  return (
    isDrasticShrinkOf_(currentData.tasks.length, newData.tasks.length) ||
    isDrasticShrinkOf_(currentData.notes.length, newData.notes.length)
  )
}

function isDrasticShrinkOf_(before, after) {
  if (before === 0) return false // nada a encolher
  return after < before * SHRINK_THRESHOLD
}

// ───────────────────────── Checksum ─────────────────────────
//
// Precisa ser BIT A BIT IDÊNTICO a `src/domain/checksum.ts` — mesma
// canonicalização (chaves alfabéticas, arrays ordenados por id, sem
// espaço), mesmo SHA-256. Rode `testChecksum()` depois de colar este
// arquivo para conferir contra o fixture do lado TypeScript.

function sortKeysDeep_(value) {
  if (Array.isArray(value)) {
    const copy = []
    for (let i = 0; i < value.length; i++) copy.push(sortKeysDeep_(value[i]))
    return copy
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {}
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (value[key] !== undefined) sorted[key] = sortKeysDeep_(value[key])
    }
    return sorted
  }
  return value
}

function sortById_(list) {
  const copy = list.slice()
  copy.sort(function (a, b) {
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
  return copy
}

function canonicalJson_(data) {
  const payload = {
    tasks: sortById_(data.tasks),
    task_events: sortById_(data.task_events),
    people: sortById_(data.people),
    notes: sortById_(data.notes),
  }
  return JSON.stringify(sortKeysDeep_(payload))
}

function computeChecksum_(data) {
  const json = canonicalJson_(data)
  const digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    json,
    Utilities.Charset.UTF_8,
  )
  let hex = ''
  for (let i = 0; i < digestBytes.length; i++) {
    const unsigned = digestBytes[i] & 0xff
    hex += (unsigned < 16 ? '0' : '') + unsigned.toString(16)
  }
  return hex
}

/**
 * Rode uma vez no editor (menu Executar → testChecksum) depois de colar o
 * código, e confira no log se o hash bate com o valor documentado em
 * `src/domain/checksum.test.ts` (FIXTURE_HASH). Se não bater, as duas
 * implementações de canonicalização divergiram em algum detalhe — o sync
 * nunca vai conseguir confirmar gravação nenhuma até isso ser corrigido,
 * porque o passo de verificação (docs seção 6.1, passo 4) compara este
 * valor com o que o front calculou.
 */
function testChecksum() {
  const fixture = {
    tasks: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Revisar PR do time',
        notes: null,
        quadrant: 'q1',
        status: 'open',
        position: 1000,
        date: null,
        delegated_to: null,
        delegation_context: null,
        expected_outcome: null,
        tags: [],
        source: 'web',
        context: 'work',
        created_at: '2026-10-15T10:00:00.000Z',
        updated_at: '2026-10-15T10:00:00.000Z',
        completed_at: null,
        deleted: false,
        device: 'pc empresa',
        source_note_id: null,
      },
    ],
    task_events: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        task_id: '11111111-1111-4111-8111-111111111111',
        type: 'created',
        from_quadrant: null,
        to_quadrant: 'q1',
        at: '2026-10-15T10:00:00.000Z',
        device: 'pc empresa',
      },
    ],
    people: [],
    notes: [],
  }

  // Mudou junto com a extensão "Anotações" (`notes` novo no payload de
  // sync, docs/prompt-anotacoes.md seção 6.1) - recalculado e verificado
  // contra computeChecksum real em src/domain/checksum.test.ts, mesmo
  // fixture.
  const expected = '56204de8c415f32ab09fd8ccde7a203fe20cbac02d141bbc3d49eb63a46dd7f4'
  const actual = computeChecksum_(fixture)

  Logger.log('Hash calculado: ' + actual)
  Logger.log('Hash esperado:  ' + expected)
  Logger.log(actual === expected ? '✓ Bate — canonicalização consistente com o front.' : '✗ NÃO bate — revise canonicalJson_().')
}
