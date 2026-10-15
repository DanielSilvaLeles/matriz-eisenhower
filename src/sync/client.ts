/**
 * Chamada HTTP de baixo nivel contra o Apps Script (docs secao 6.4). Tudo
 * por POST, `Content-Type: text/plain`, corpo JSON - evita pre-voo de CORS
 * e mantem o token fora da URL.
 *
 * Classifica toda falha num dos motivos que a interface sabe explicar
 * (docs secao 6.3): "sem internet; URL do script invalida; token recusado;
 * resposta inesperada (provavel bloqueio da rede ou pagina de login do
 * Google); conflito". O navegador nao expoe POR QUE um fetch falhou (por
 * design, questao de privacidade/seguranca) - entao "resposta inesperada" e
 * o balde que recebe tudo que nao da pra diferenciar com certeza.
 */
import {
  syncRequestSchema,
  syncResponseSchema,
  type SyncAction,
  type SyncData,
} from '@/domain/syncProtocol.ts'

export const SYNC_ERROR_KINDS = [
  'offline',
  'invalid_url',
  'unauthorized',
  'unexpected_response',
  'busy',
  'conflict',
] as const
export type SyncErrorKind = (typeof SYNC_ERROR_KINDS)[number]

export interface SyncCallParams {
  readonly url: string
  readonly token: string
  readonly action: SyncAction
  readonly baseRevision?: number
  readonly data?: SyncData
  readonly allowShrink?: boolean
}

export interface SyncCallSuccess {
  readonly ok: true
  readonly revision: number
  readonly checksum: string
  readonly data: SyncData
}

export interface SyncCallFailure {
  readonly ok: false
  readonly kind: SyncErrorKind
}

export type SyncCallResult = SyncCallSuccess | SyncCallFailure

/** Só aceita URLs do próprio Apps Script - qualquer outra coisa já é "URL inválida". */
function isValidScriptUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'script.google.com'
  } catch {
    return false
  }
}

export async function callSync(params: SyncCallParams): Promise<SyncCallResult> {
  if (!isValidScriptUrl(params.url)) return { ok: false, kind: 'invalid_url' }
  if (!navigator.onLine) return { ok: false, kind: 'offline' }

  const body = syncRequestSchema.parse({
    token: params.token,
    action: params.action,
    baseRevision: params.baseRevision,
    data: params.data,
    allowShrink: params.allowShrink,
  })

  let raw: Response
  try {
    raw = await fetch(params.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    })
  } catch {
    // CORS, DNS, conexao recusada, rede bloqueando o dominio - o navegador
    // nao distingue nenhum desses casos de propósito.
    return { ok: false, kind: 'unexpected_response' }
  }

  if (!raw.ok) return { ok: false, kind: 'unexpected_response' }

  let json: unknown
  try {
    json = await raw.json()
  } catch {
    // Provavelmente HTML (pagina de login do Google, ou de bloqueio da
    // rede) em vez do JSON esperado.
    return { ok: false, kind: 'unexpected_response' }
  }

  const parsed = syncResponseSchema.safeParse(json)
  if (!parsed.success) return { ok: false, kind: 'unexpected_response' }

  if (!parsed.data.ok) {
    if (parsed.data.error === 'unauthorized') return { ok: false, kind: 'unauthorized' }
    if (parsed.data.error === 'busy') return { ok: false, kind: 'busy' }
    if (parsed.data.error === 'conflict') return { ok: false, kind: 'conflict' }
    // 'invalid' ou 'server': falha do nosso proprio pedido ou do script -
    // nenhuma das duas e algo que a pessoa consiga corrigir sozinha.
    return { ok: false, kind: 'unexpected_response' }
  }

  return {
    ok: true,
    revision: parsed.data.revision,
    checksum: parsed.data.checksum,
    data: parsed.data.data,
  }
}
