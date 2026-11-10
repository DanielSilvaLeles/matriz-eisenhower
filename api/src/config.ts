/**
 * Configuração só por variável de ambiente (o `.env` da VPS, nunca o
 * repositório). Falha na partida, com mensagem clara, se faltar algo - um
 * container que sobe "meio configurado" é pior do que um que não sobe.
 */
export interface Config {
  readonly port: number
  readonly host: string
  readonly databaseUrl: string
  readonly apiKey: string
  /** Prefixo das rotas: a API mora em api.leles.tec.br/matriz. */
  readonly basePath: string
  readonly maxBodyBytes: number
}

const MIN_API_KEY_LENGTH = 32

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = []
  const databaseUrl = env['DATABASE_URL'] ?? ''
  const apiKey = env['MATRIZ_API_KEY'] ?? ''
  if (databaseUrl === '') problems.push('DATABASE_URL ausente')
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    problems.push(`MATRIZ_API_KEY ausente ou curta demais (mínimo ${MIN_API_KEY_LENGTH} caracteres)`)
  }
  const port = Number(env['PORT'] ?? '5002')
  if (!Number.isInteger(port) || port <= 0) problems.push('PORT inválida')
  if (problems.length > 0) throw new Error(`configuração inválida: ${problems.join('; ')}`)

  const basePath = (env['BASE_PATH'] ?? '/matriz').replace(/\/+$/u, '')
  return {
    port,
    host: env['HOST'] ?? '0.0.0.0',
    databaseUrl,
    apiKey,
    basePath,
    maxBodyBytes: Number(env['MAX_BODY_BYTES'] ?? 4 * 1024 * 1024),
  }
}
