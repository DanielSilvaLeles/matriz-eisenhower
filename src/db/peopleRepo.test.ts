import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MatrizDB } from './schema.ts'
import { ensurePersonInTx, listPeopleNames } from './peopleRepo.ts'

let db: MatrizDB

beforeEach(() => {
  db = new MatrizDB(`teste-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('ensurePersonInTx', () => {
  it('cria a pessoa quando o nome e novo', async () => {
    await db.transaction('rw', db.people, async () => {
      await ensurePersonInTx(db, 'Ana', '2026-10-15T10:00:00.000Z')
    })

    const people = await db.people.toArray()
    expect(people).toHaveLength(1)
    expect(people[0]).toMatchObject({ name: 'Ana' })
  })

  it('nao duplica quando o nome ja existe, ignorando maiusculas/minusculas', async () => {
    await db.transaction('rw', db.people, async () => {
      await ensurePersonInTx(db, 'Ana', '2026-10-15T10:00:00.000Z')
      await ensurePersonInTx(db, 'ana', '2026-10-15T10:05:00.000Z')
      await ensurePersonInTx(db, 'ANA', '2026-10-15T10:06:00.000Z')
    })

    const people = await db.people.toArray()
    expect(people).toHaveLength(1)
  })

  it('ignora nome vazio ou so com espacos', async () => {
    await db.transaction('rw', db.people, async () => {
      await ensurePersonInTx(db, '   ', '2026-10-15T10:00:00.000Z')
    })

    const people = await db.people.toArray()
    expect(people).toHaveLength(0)
  })
})

describe('listPeopleNames', () => {
  it('devolve os nomes em ordem alfabetica', async () => {
    await db.transaction('rw', db.people, async () => {
      await ensurePersonInTx(db, 'Zeca', '2026-10-15T10:00:00.000Z')
      await ensurePersonInTx(db, 'Ana', '2026-10-15T10:01:00.000Z')
      await ensurePersonInTx(db, 'Bruno', '2026-10-15T10:02:00.000Z')
    })

    expect(await listPeopleNames(db)).toEqual(['Ana', 'Bruno', 'Zeca'])
  })
})
