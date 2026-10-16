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
  notes: [],
}

/**
 * Mudou junto com a extensão "Anotações" (`notes` novo no payload de sync,
 * docs/prompt-anotacoes.md seção 6.1) - recalculado e verificado de tres
 * formas independentes: `computeChecksum` real (este teste), um script
 * Node replicando a mesma canonicalizacao, e `shasum -a 256` na linha de
 * comando sobre o mesmo JSON canônico, antes de atualizar
 * `apps-script/Code.gs::testChecksum()` para o mesmo valor.
 */
const FIXTURE_HASH = '56204de8c415f32ab09fd8ccde7a203fe20cbac02d141bbc3d49eb63a46dd7f4'

/**
 * `includeNotes: false` (compatibilidade com o script antigo, docs
 * secao 1.6) tem que reproduzir EXATAMENTE o hash que este mesmo arquivo
 * calculava antes da extensão "Anotações" existir - é literalmente o
 * mesmo conteúdo (`FIXTURE` sem a chave `notes`), então é o mesmo
 * cálculo de sempre.
 */
const LEGACY_FIXTURE_HASH = '8aca9634cc91eaf1efa2c9719e16d962f75eae3df0827e836a1c3209ba75c037'

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
      notes: [],
    }
    const json = canonicalJSON(embaralhado)
    expect(json.indexOf('"aaa"')).toBeLessThan(json.indexOf('"zzz"'))
  })

  it('e deterministico: mesma entrada produz sempre o mesmo texto', () => {
    expect(canonicalJSON(FIXTURE)).toBe(canonicalJSON(FIXTURE))
  })

  it('listas vazias nao quebram nada', () => {
    expect(() => canonicalJSON({ tasks: [], taskEvents: [], people: [], notes: [] })).not.toThrow()
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

  it('includeNotes:false (compatibilidade com script antigo) reproduz o hash de antes da extensão "Anotações"', async () => {
    await expect(computeChecksum(FIXTURE, false)).resolves.toBe(LEGACY_FIXTURE_HASH)
  })

  it('includeNotes:false ignora o conteudo de notes por completo, mesmo se nao vazio', async () => {
    const comNota: ChecksumContents = {
      ...FIXTURE,
      notes: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          title: null,
          body: 'Isto nao deveria entrar no hash legado',
          tags: [],
          created_at: '2026-10-15T10:00:00.000Z',
          updated_at: '2026-10-15T10:00:00.000Z',
          deleted: false,
          deleted_at: null,
          device: 'pc empresa',
        },
      ],
    }
    await expect(computeChecksum(comNota, false)).resolves.toBe(LEGACY_FIXTURE_HASH)
  })

  it('a ordem de insercao nao importa, so o conteudo', async () => {
    const a: ChecksumContents = {
      tasks: [
        { ...FIXTURE.tasks[0]!, id: 'a' },
        { ...FIXTURE.tasks[0]!, id: 'b' },
      ],
      taskEvents: [],
      people: [],
      notes: [],
    }
    const b: ChecksumContents = {
      tasks: [...a.tasks].toReversed(),
      taskEvents: [],
      people: [],
      notes: [],
    }
    expect(await computeChecksum(a)).toBe(await computeChecksum(b))
  })
})
