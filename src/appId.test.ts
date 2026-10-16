import { describe, expect, it } from 'vitest'
import { appNameFor, cacheIdFor, dbNameFor, storageKeyFor } from './appId.ts'

/**
 * Chaves de armazenamento usadas hoje pelo app (docs/prompt-anotacoes.md
 * seção 1.8) - a mesma lista literal de `src/db/schema.ts`,
 * `src/ui/theme.ts`, `src/db/device.ts` e `src/sync/config.ts`. Mantida
 * aqui, não importada de lá, de propósito: o teste prova que o app id de
 * produção reproduz os nomes ATUAIS mesmo que algum desses arquivos mude
 * a implementação no futuro - comparar contra os literais, não contra a
 * própria função que o código de produção chama.
 */
const CURRENT_STORAGE_KEYS = ['matriz:tema', 'matriz:device', 'matriz:sync:url', 'matriz:sync:token']

describe('appId: produção (id vazio) reproduz exatamente os nomes de hoje', () => {
  it('nome do banco Dexie', () => {
    expect(dbNameFor('')).toBe('matriz-eisenhower')
  })

  it('toda chave de localStorage usada hoje, sem nenhum prefixo', () => {
    for (const key of CURRENT_STORAGE_KEYS) {
      expect(storageKeyFor('', key)).toBe(key)
    }
  })

  it('cacheId do service worker ausente (undefined) - vite.config.ts não passa a opção', () => {
    expect(cacheIdFor('')).toBeUndefined()
  })

  it('nome do app', () => {
    expect(appNameFor('')).toBe('Matriz de Eisenhower')
  })
})

describe('appId: dois ids diferentes nunca compartilham nenhuma chave de armazenamento', () => {
  const ids = ['', 'matriz-eisenhower-beta', 'outro-id-qualquer']

  it('nome do banco Dexie é único por id', () => {
    const names = ids.map((id) => dbNameFor(id))
    expect(new Set(names).size).toBe(names.length)
  })

  it('toda chave de localStorage é única por id, para cada chave usada hoje', () => {
    for (const key of CURRENT_STORAGE_KEYS) {
      const keys = ids.map((id) => storageKeyFor(id, key))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('cacheId é único por id não-vazio, e ausente so para o id vazio', () => {
    const nonEmptyIds = ids.filter((id) => id !== '')
    const cacheIds = nonEmptyIds.map((id) => cacheIdFor(id))
    expect(new Set(cacheIds).size).toBe(cacheIds.length)
    expect(cacheIdFor('')).toBeUndefined()
  })

  it('nenhuma chave de armazenamento de um id aparece como chave de armazenamento de outro id', () => {
    // Cada tipo de chave (banco, chave de localStorage, cacheId) de todos
    // os ids, numa lista só - nenhum valor pode se repetir entre ids
    // diferentes, nem entre tipos diferentes de chave.
    const allKeys: string[] = []
    for (const id of ids) {
      allKeys.push(dbNameFor(id))
      for (const key of CURRENT_STORAGE_KEYS) allKeys.push(storageKeyFor(id, key))
      const cid = cacheIdFor(id)
      if (cid !== undefined) allKeys.push(`cache:${cid}`)
    }
    expect(new Set(allKeys).size).toBe(allKeys.length)
  })
})
