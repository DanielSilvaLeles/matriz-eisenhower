/**
 * URL e token do Apps Script: guardados SO no localStorage do aparelho
 * (docs secao 5.8) - nunca no repositorio, nunca na URL de uma requisicao
 * (vao no corpo POST), nunca em log ou mensagem de erro.
 */
import { storageKey } from '@/appId.ts'

const URL_KEY = storageKey('matriz:sync:url')
const TOKEN_KEY = storageKey('matriz:sync:token')

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeLocal(key: string, value: string): void {
  try {
    if (value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento (navegacao privada, por exemplo): a configuracao
    // vale so para esta sessao, ja que nao ha onde persistir.
  }
}

export function getSyncUrl(): string {
  return readLocal(URL_KEY)
}

export function setSyncUrl(url: string): void {
  writeLocal(URL_KEY, url.trim())
}

export function getSyncToken(): string {
  return readLocal(TOKEN_KEY)
}

export function setSyncToken(token: string): void {
  writeLocal(TOKEN_KEY, token.trim())
}

/** Sincronização só faz sentido depois de URL e token preenchidos. */
export function isSyncConfigured(): boolean {
  return getSyncUrl() !== '' && getSyncToken() !== ''
}
