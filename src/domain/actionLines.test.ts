import { describe, expect, it } from 'vitest'
import { extractActionLines, markActionLineSent } from './actionLines.ts'

describe('extractActionLines', () => {
  it('reconhece "[ ] " e "- [ ] " como linhas de acao pendentes', () => {
    const body = 'Reunião com fornecedor\n[ ] Cobrar proposta\n- [ ] Enviar contrato\nResto do texto'
    const lines = extractActionLines(body)

    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ lineIndex: 1, text: 'Cobrar proposta', sent: false })
    expect(lines[1]).toEqual({ lineIndex: 2, text: 'Enviar contrato', sent: false })
  })

  it('nao confunde um marcador de lista simples ("- ") com item de acao', () => {
    const body = '- Apenas um tópico de lista\n[x] Isso também não é o marcador certo'
    expect(extractActionLines(body)).toHaveLength(0)
  })

  it('reconhece "[→] " como ja enviada, sem marcar para reenvio', () => {
    const body = '[→] Já enviei isso\n[ ] Isso ainda não'
    const lines = extractActionLines(body)

    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ lineIndex: 0, text: 'Já enviei isso', sent: true })
    expect(lines[1]).toEqual({ lineIndex: 1, text: 'Isso ainda não', sent: false })
  })

  it('preserva indentacao e mantem a ordem das linhas do texto', () => {
    const body = '  [ ] Linha indentada\nTexto normal\n[ ] Outra linha de acao'
    const lines = extractActionLines(body)
    expect(lines.map((l) => l.text)).toEqual(['Linha indentada', 'Outra linha de acao'])
  })
})

describe('markActionLineSent', () => {
  it('troca "[ ] " por "[→] ", preservando o resto da linha', () => {
    const body = 'Título\n[ ] Cobrar proposta\nResto'
    const result = markActionLineSent(body, 1)
    expect(result).toBe('Título\n[→] Cobrar proposta\nResto')
  })

  it('troca "- [ ] " por "- [→] "', () => {
    const body = '- [ ] Enviar contrato'
    expect(markActionLineSent(body, 0)).toBe('- [→] Enviar contrato')
  })

  it('preserva indentacao', () => {
    const body = '  [ ] Linha indentada'
    expect(markActionLineSent(body, 0)).toBe('  [→] Linha indentada')
  })

  it('nao faz nada se a linha ja estiver marcada como enviada (evita reenvio por engano)', () => {
    const body = '[→] Já enviada'
    expect(markActionLineSent(body, 0)).toBe(body)
  })

  it('nao faz nada se a linha nao for uma linha de acao', () => {
    const body = 'Texto qualquer'
    expect(markActionLineSent(body, 0)).toBe(body)
  })

  it('nao faz nada se o indice estiver fora do texto', () => {
    const body = '[ ] Unica linha'
    expect(markActionLineSent(body, 5)).toBe(body)
  })

  it('so marca a linha pedida, deixando as outras linhas de acao intactas', () => {
    const body = '[ ] Primeira\n[ ] Segunda'
    expect(markActionLineSent(body, 1)).toBe('[ ] Primeira\n[→] Segunda')
  })
})
