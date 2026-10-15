/**
 * Regras e metadados dos quatro quadrantes da Matriz de Eisenhower.
 *
 * Modulo puro: sem React, sem banco, sem rede. Tudo que decide "em que
 * quadrante isso cai" e "quanto cabe" vive aqui e tem teste.
 */

export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4'

/**
 * Acima de 10 tarefas abertas a matriz vira lista e perde a funcao
 * (docs secao 3, principio 6). O limite avisa, nunca bloqueia: perder uma
 * captura e pior do que estourar o limite.
 */
export const MAX_OPEN_TASKS = 10

/** A partir daqui o contador fica em ambar, antes de encher. */
export const WARN_OPEN_TASKS = 8

export interface QuadrantMeta {
  readonly id: QuadrantId
  /** O verbo da acao. E o rotulo principal, nao um enfeite da cor. */
  readonly verb: string
  /** Uma linha curta de apoio no cabecalho. */
  readonly support: string
  readonly urgent: boolean
  readonly important: boolean
  /**
   * Existe um unico campo de data por tarefa e o rotulo muda por quadrante.
   * Q4 e o unico sem data: soltar ali e decidir nao fazer, nao agendar nada.
   */
  readonly dateLabel: string | null
  /** Exemplo do contexto real do usuario, para o estado vazio. */
  readonly emptyExample: string
}

const Q1: QuadrantMeta = {
  id: 'q1',
  verb: 'Fazer',
  support: 'Urgente e importante',
  urgent: true,
  important: true,
  dateLabel: 'Prazo',
  emptyExample: 'incidente em produção',
}

const Q2: QuadrantMeta = {
  id: 'q2',
  verb: 'Agendar',
  support: 'Importante, não urgente',
  urgent: false,
  important: true,
  dateLabel: 'Agendada para',
  emptyExample: 'preparar os 1:1 da semana',
}

const Q3: QuadrantMeta = {
  id: 'q3',
  verb: 'Delegar',
  support: 'Urgente, não importante',
  urgent: true,
  important: false,
  dateLabel: 'Cobrar em',
  emptyExample: 'agendar a reunião com o fornecedor',
}

const Q4: QuadrantMeta = {
  id: 'q4',
  verb: 'Eliminar',
  support: 'Nem urgente nem importante',
  urgent: false,
  important: false,
  dateLabel: null,
  emptyExample: 'reunião de status sem pauta',
}

/**
 * Ordem de leitura, que é também a ordem espacial da grade:
 * q1 em cima à esquerda, q2 em cima à direita, q3 embaixo à esquerda,
 * q4 embaixo à direita. A triagem e a mini matriz do mobile reusam esta
 * mesma ordem, para o destino ficar sempre no mesmo lugar da tela.
 */
export const QUADRANTS: readonly QuadrantMeta[] = [Q1, Q2, Q3, Q4]

const BY_ID: Record<QuadrantId, QuadrantMeta> = { q1: Q1, q2: Q2, q3: Q3, q4: Q4 }

export function quadrantMeta(id: QuadrantId): QuadrantMeta {
  return BY_ID[id]
}

/**
 * Os dois eixos definem o quadrante. E esta funcao que o "Me ajude a decidir"
 * da triagem usa, a partir de duas perguntas de sim ou nao (docs secao 5.3) -
 * regra simples, sem IA.
 */
export function quadrantFor(urgent: boolean, important: boolean): QuadrantId {
  if (important) return urgent ? 'q1' : 'q2'
  return urgent ? 'q3' : 'q4'
}

/** Passou de 10: a matriz precisa avisar, mas sem travar a adicao. */
export function isOverLimit(openCount: number): boolean {
  return openCount > MAX_OPEN_TASKS
}

/** Cheio exatamente no limite, ou alem dele. */
export function isAtOrOverLimit(openCount: number): boolean {
  return openCount >= MAX_OPEN_TASKS
}

/** Perto do limite: o contador muda de cor antes de o problema acontecer. */
export function isNearLimit(openCount: number): boolean {
  return openCount >= WARN_OPEN_TASKS && openCount < MAX_OPEN_TASKS
}
