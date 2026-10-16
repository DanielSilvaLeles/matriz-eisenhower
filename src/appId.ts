/**
 * Build para dois repositórios sem conflito de dados
 * (`docs/prompt-anotacoes.md` seção 1.8): o navegador isola armazenamento
 * (localStorage, IndexedDB, Cache Storage) por ORIGEM, não por caminho -
 * `danielsilvaleles.github.io/matriz-eisenhower/` e
 * `danielsilvaleles.github.io/matriz-eisenhower-beta/` são a MESMA origem
 * (`https://danielsilvaleles.github.io`). Sem isolar explicitamente, o
 * beta abriria e migraria o banco real da produção.
 *
 * `VITE_APP_ID` vem do workflow de deploy (`.github/workflows/deploy.yml`),
 * calculado a partir de `github.event.repository.name`. **Convenção
 * central desta extensão: o repositório de produção usa o id vazio `''`**
 * - por isso toda função `*For` aqui devolve exatamente o nome de sempre
 * quando `appId === ''`, sem nenhum prefixo. Qualquer outro nome de
 * repositório (ex.: "matriz-eisenhower-beta") usa o próprio nome do repo
 * como id e prefixa tudo. Em dev local (sem a variável definida), o id
 * também é `''` - o ambiente de desenvolvimento usa os mesmos nomes de
 * produção.
 *
 * As funções `*For` recebem o id explícito (puras, testáveis com
 * qualquer combinação - ver `appId.test.ts`); as funções sem sufixo são a
 * conveniência que o resto do app usa, já amarradas ao `APP_ID` real desta
 * build.
 */
export const APP_ID: string = import.meta.env.VITE_APP_ID ?? ''

export const IS_BETA: boolean = APP_ID !== ''

/** Nome do banco Dexie - "matriz-eisenhower" para o id vazio (produção), sem exceção. */
export function dbNameFor(appId: string): string {
  return appId === '' ? 'matriz-eisenhower' : `${appId}-matriz-eisenhower`
}

/**
 * Prefixo de uma chave de `localStorage` - a chave passa batida para o id
 * vazio (produção: `storageKeyFor('', 'matriz:tema') === 'matriz:tema'`,
 * idêntico a antes desta extensão existir), e ganha `"<appId>:"` na
 * frente para qualquer outro id.
 */
export function storageKeyFor(appId: string, key: string): string {
  return appId === '' ? key : `${appId}:${key}`
}

/** `cacheId` do service worker (Workbox) - `undefined` para o id vazio, para o `workbox` do `vite.config.ts` não passar a opção. */
export function cacheIdFor(appId: string): string | undefined {
  return appId === '' ? undefined : appId
}

/** Nome do app no manifest/cabeçalho - "Matriz de Eisenhower" para o id vazio, "Matriz (beta)" para qualquer outro. */
export function appNameFor(appId: string): string {
  return appId === '' ? 'Matriz de Eisenhower' : 'Matriz (beta)'
}

export function dbName(): string {
  return dbNameFor(APP_ID)
}

export function storageKey(key: string): string {
  return storageKeyFor(APP_ID, key)
}

export function cacheId(): string | undefined {
  return cacheIdFor(APP_ID)
}

export function appName(): string {
  return appNameFor(APP_ID)
}
