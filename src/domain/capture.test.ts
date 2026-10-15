import { describe, expect, it } from 'vitest'
import { extractTags, splitCaptureLines } from './capture.ts'

describe('extractTags', () => {
  it('sem tag, devolve o texto como titulo e tags vazio', () => {
    expect(extractTags('Revisar PR do time')).toEqual({
      title: 'Revisar PR do time',
      tags: [],
    })
  })

  it('tira a tag do titulo e devolve em tags', () => {
    const result = extractTags('Revisar PR #fornecedor do time')
    expect(result.title).toBe('Revisar PR do time')
    expect(result.tags).toEqual(['fornecedor'])
  })

  it('aceita mais de uma tag', () => {
    const result = extractTags('Preparar #1:1 #fornecedor reuniao')
    expect(result.tags).toEqual(['1', 'fornecedor'])
  })

  it('normaliza para minusculas, para #Fornecedor e #fornecedor serem a mesma tag', () => {
    expect(extractTags('#Fornecedor e #fornecedor').tags).toEqual(['fornecedor'])
  })

  it('aceita acento na tag', () => {
    expect(extractTags('Projeto #ágil').tags).toEqual(['ágil'])
  })

  it('nao interpreta nada alem de #tag', () => {
    const result = extractTags('Falar com @fulano sobre !urgente')
    expect(result.title).toBe('Falar com @fulano sobre !urgente')
    expect(result.tags).toEqual([])
  })

  it('tag sozinha vira titulo vazio (quem chama decide o que fazer)', () => {
    expect(extractTags('#soatag')).toEqual({ title: '', tags: ['soatag'] })
  })

  it('nao deixa espaco duplo onde a tag saiu', () => {
    expect(extractTags('Antes #tag depois').title).toBe('Antes depois')
  })
})

describe('splitCaptureLines', () => {
  it('uma linha so vira um item', () => {
    expect(splitCaptureLines('Uma tarefa')).toEqual(['Uma tarefa'])
  })

  it('varias linhas viram varios itens', () => {
    expect(splitCaptureLines('Primeira\nSegunda\nTerceira')).toEqual([
      'Primeira',
      'Segunda',
      'Terceira',
    ])
  })

  it('aceita quebra de linha do Windows (CRLF)', () => {
    expect(splitCaptureLines('Primeira\r\nSegunda')).toEqual(['Primeira', 'Segunda'])
  })

  it('descarta linhas vazias, inclusive so com espaco', () => {
    expect(splitCaptureLines('Primeira\n\n   \nSegunda\n')).toEqual([
      'Primeira',
      'Segunda',
    ])
  })

  it('apara espaco nas pontas de cada linha', () => {
    expect(splitCaptureLines('  Com espaco  \n  Outra  ')).toEqual([
      'Com espaco',
      'Outra',
    ])
  })

  it('texto vazio vira lista vazia', () => {
    expect(splitCaptureLines('')).toEqual([])
    expect(splitCaptureLines('   ')).toEqual([])
  })
})
