/**
 * Ponto de entrada: confere a configuração, aplica as migrations pendentes e
 * sobe o servidor. Encerra limpo no SIGTERM (`docker stop`/deploy), deixando
 * as requisições em andamento terminarem antes de fechar o pool.
 */
import { createServer } from 'node:http'
import { loadConfig } from './config.ts'
import { createPool } from './db.ts'
import { createHandler } from './http.ts'
import { migrate } from './migrate.ts'

const config = loadConfig()
const pool = createPool(config.databaseUrl)

const applied = await migrate(pool)
if (applied.length > 0) console.log(`[matriz-api] migrations aplicadas: ${applied.join(', ')}`)

const handler = createHandler(config, pool)
const server = createServer((req, res) => {
  void handler(req, res)
})
server.requestTimeout = 30_000

server.listen(config.port, config.host, () => {
  console.log(`[matriz-api] ouvindo em ${config.host}:${config.port}${config.basePath}`)
})

function shutdown(signal: string): void {
  console.log(`[matriz-api] ${signal} recebido, encerrando`)
  server.close(() => {
    void pool.end().then(() => process.exit(0))
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  shutdown('SIGINT')
})
