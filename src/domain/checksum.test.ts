import { describe, expect, it } from 'vitest'
import { canonicalJSON, computeChecksum, type ChecksumContents } from './checksum.ts'

/**
 * Fixture de paridade com `apps-script/Code.gs::testChecksum()`. O hash
 * abaixo e conferido manualmente contra o que o script devolve, para os
 * dois lados do sync calcularem exatamente o mesmo numero a partir do
 * mesmo conteudo - sem essa igualdade, a verificacao pos-escrita
 * (docs secao 6.1, passo 4) nunca bateria.
 */
const FIXTURE: ChecksumContents = {
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
  taskEvents: [
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
}

/**
 * Mudou junto com a extensão "Anotações" (`tasks.source_note_id` novo no
 * schema) - recalculado e verificado de duas formas independentes:
 * `computeChecksum` real (este teste) e `shasum -a 256` na linha de
 * comando sobre o mesmo JSON canônico, antes de atualizar
 * `apps-script/Code.gs::testChecksum()` para o mesmo valor.
 */
const FIXTURE_HASH = '8aca9634cc91eaf1efa2c9719e16d962f75eae3df0827e836a1c3209ba75c037'

describe('canonicalJSON', () => {
  it('ordena as chaves de cada objeto alfabeticamente', () => {
    const json = canonicalJSON(FIXTURE)
    const taskStart = json.indexOf('"tasks":[{') + '"tasks":[{'.length
    const firstKeys = json.slice(taskStart, taskStart + 40)
    // "completed_at" vem antes de "context", que vem antes de "created_at"...
    expect(firstKeys.startsWith('"completed_at"')).toBe(true)
  })

  it('ordena tasks, task_events e people por id', () => {
    const embaralhado: ChecksumContents = {
      tasks: [
        { ...FIXTURE.tasks[0]!, id: 'zzz' },
        { ...FIXTURE.tasks[0]!, id: 'aaa' },
      ],
      taskEvents: [],
      people: [],
    }
    const json = canonicalJSON(embaralhado)
    expect(json.indexOf('"aaa"')).toBeLessThan(json.indexOf('"zzz"'))
  })

  it('e deterministico: mesma entrada produz sempre o mesmo texto', () => {
    expect(canonicalJSON(FIXTURE)).toBe(canonicalJSON(FIXTURE))
  })

  it('listas vazias nao quebram nada', () => {
    expect(() => canonicalJSON({ tasks: [], taskEvents: [], people: [] })).not.toThrow()
  })
})

describe('computeChecksum', () => {
  it('bate com o hash de paridade do apps-script/Code.gs', async () => {
    await expect(computeChecksum(FIXTURE)).resolves.toBe(FIXTURE_HASH)
  })

  it('qualquer mudanca no conteudo muda o hash', async () => {
    const alterado: ChecksumContents = {
      ...FIXTURE,
      tasks: [{ ...FIXTURE.tasks[0]!, title: 'Outro titulo' }],
    }
    const original = await computeChecksum(FIXTURE)
    const mudado = await computeChecksum(alterado)
    expect(mudado).not.toBe(original)
  })

  it('a ordem de insercao nao importa, so o conteudo', async () => {
    const a: ChecksumContents = {
      tasks: [
        { ...FIXTURE.tasks[0]!, id: 'a' },
        { ...FIXTURE.tasks[0]!, id: 'b' },
      ],
      taskEvents: [],
      people: [],
    }
    const b: ChecksumContents = {
      tasks: [...a.tasks].toReversed(),
      taskEvents: [],
      people: [],
    }
    expect(await computeChecksum(a)).toBe(await computeChecksum(b))
  })
})
