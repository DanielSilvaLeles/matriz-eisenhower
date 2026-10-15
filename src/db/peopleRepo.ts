/**
 * Pessoas (docs secao 10): existem so para alimentar o autocomplete de
 * "Para quem?" na delegacao (docs secao 5.3/5.4) - `tasks.delegated_to`
 * continua sendo o nome em texto livre, nunca uma referencia por id. Uma
 * pessoa e criada automaticamente na primeira vez que o nome e usado.
 */
import type { MatrizDB } from './schema.ts'

function newId(): string {
  return crypto.randomUUID()
}

/** Nomes conhecidos, para o `<datalist>` do campo "Para quem?" (docs secao 5.3). */
export async function listPeopleNames(db: MatrizDB): Promise<readonly string[]> {
  const people = await db.people.toArray()
  return people.map((p) => p.name).toSorted((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Garante que o nome existe em `people` - chamar dentro da mesma transacao
 * que grava a delegacao. Comparacao sem diferenciar maiusculas/minusculas,
 * para "Ana" e "ana" nao virarem duas pessoas.
 */
export async function ensurePersonInTx(db: MatrizDB, name: string, now: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed === '') return

  const existing = await db.people.toArray()
  const already = existing.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
  if (already) return

  await db.people.add({ id: newId(), name: trimmed, updated_at: now })
}
