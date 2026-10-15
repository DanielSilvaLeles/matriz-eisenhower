import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureItem } from './capture.ts'
import { DB_NAME, MatrizDB } from '@/db/schema.ts'

// captureItem usa getDB(), o singleton do banco de verdade (nome fixo
// DB_NAME) - nao da pra passar um banco de teste por parametro sem mudar a
// assinatura da funcao que a UI vai chamar. Isolamento aqui e por tempo:
// apaga o banco padrao antes e depois de cada teste.

beforeEach(async () => {
  await new MatrizDB(DB_NAME).delete()
})

afterEach(async () => {
  await new MatrizDB(DB_NAME).delete()
})

describe('captureItem', () => {
  it('uma linha vira um item na caixa de entrada', async () => {
    const created = await captureItem({ text: 'Revisar PR do time', source: 'web' })

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      title: 'Revisar PR do time',
      quadrant: null,
      source: 'web',
      tags: [],
    })
  })

  it('varias linhas coladas viram varios itens, na ordem colada', async () => {
    const created = await captureItem({
      text: 'Primeira\nSegunda\nTerceira',
      source: 'web',
    })

    expect(created.map((task) => task.title)).toEqual(['Primeira', 'Segunda', 'Terceira'])
    expect(created[0]?.position).toBeLessThan(created[1]?.position ?? Infinity)
    expect(created[1]?.position).toBeLessThan(created[2]?.position ?? Infinity)
  })

  it('tira a #tag do titulo e grava em tags', async () => {
    const [task] = await captureItem({
      text: 'Preparar proposta #fornecedor',
      source: 'web',
    })
    expect(task?.title).toBe('Preparar proposta')
    expect(task?.tags).toEqual(['fornecedor'])
  })

  it('descarta linha que vira so tag, sem titulo', async () => {
    const created = await captureItem({ text: '#soatag\nTarefa de verdade', source: 'web' })
    expect(created).toHaveLength(1)
    expect(created[0]?.title).toBe('Tarefa de verdade')
  })

  it('texto vazio ou so espaco nao cria nada', async () => {
    expect(await captureItem({ text: '', source: 'web' })).toHaveLength(0)
    expect(await captureItem({ text: '   ', source: 'web' })).toHaveLength(0)
  })

  it('registra a origem informada', async () => {
    const [task] = await captureItem({ text: 'Via share target', source: 'share' })
    expect(task?.source).toBe('share')
  })
})
