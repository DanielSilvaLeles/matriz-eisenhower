/**
 * Favoritas (estrela) - vale igual para tarefa e anotação.
 *
 * O campo `favorite` é OPCIONAL no schema (`src/domain/schema.ts`), e
 * "ausente" significa "não favorita". Escolha deliberada, em vez de um
 * `boolean` obrigatório:
 *
 * - **Sem migração do Dexie:** tarefa/anotação gravada antes deste campo
 *   existir continua válida como está, sem `.upgrade()` reescrevendo o
 *   banco inteiro.
 * - **Checksum de dados antigos não muda:** a canonicalização trata
 *   `undefined` como ausente (`src/domain/checksum.ts` e `Code.gs`), então
 *   um `matriz.json` sem nenhuma favorita tem exatamente o mesmo hash de
 *   antes - nenhum push "fantasma" na primeira sincronização depois de
 *   atualizar o app.
 * - **Não precisa reimplantar o `Code.gs`:** `isValidTask_`/`isValidNote_`
 *   só conferem os campos que conhecem e ignoram chave a mais, e a
 *   canonicalização do checksum é genérica (qualquer chave, em ordem
 *   alfabética) - o script já publicado guarda e devolve `favorite` sem
 *   saber que ele existe.
 *
 * Favoritar/desfavoritar muda `updated_at` (e marca pendente): é o que
 * faz a mudança viajar na sincronização ("vence o `updated_at` mais
 * recente", docs seção 6.2). Não gera `task_events` - assim como editar
 * campos no painel de detalhe, não é um evento da linha do tempo.
 */

export function isFavorite(item: { readonly favorite?: boolean | undefined }): boolean {
  return item.favorite === true
}

/**
 * Favoritas primeiro, preservando a ordem relativa que a lista já tinha
 * dentro de cada grupo (partição estável - não reordena por nenhum outro
 * critério).
 */
export function favoritesFirst<T extends { readonly favorite?: boolean | undefined }>(
  items: readonly T[],
): T[] {
  const favorites: T[] = []
  const others: T[] = []
  for (const item of items) {
    if (isFavorite(item)) favorites.push(item)
    else others.push(item)
  }
  return [...favorites, ...others]
}
