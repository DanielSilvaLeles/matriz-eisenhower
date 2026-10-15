/**
 * Posicao fracionaria para ordenar tarefas dentro de um quadrante.
 *
 * Por que fracionario e nao indice inteiro sequencial: reordenar com
 * inteiros reescreve N tarefas a cada arraste (toda tarefa entre a origem e
 * o destino muda de indice), o que marcaria N tarefas como pendentes de
 * sincronizacao e infla o payload do sync a toa. Com posicao fracionaria,
 * mover uma tarefa para o lugar certo muda **uma unica** tarefa: a sua.
 *
 * O preco e que bissetar repetidamente o mesmo intervalo (inserir sempre
 * entre as duas mesmas tarefas) estreita o espaco entre elas a cada vez.
 * Um numero de ponto flutuante (float64) tem cerca de 52 bits de mantissa -
 * ~1074 bissecoes seguidas no mesmo intervalo antes de duas posicoes
 * colidirem. Para um unico usuario reordenando a mao, isso nunca acontece
 * na pratica, mas o codigo nao aposta nisso: ao detectar um intervalo
 * pequeno demais para o calculo de ponto medio continuar confiavel,
 * renormaliza as posicoes do quadrante inteiro com espacamento parelho.
 */

/** Distancia inicial entre duas tarefas recem-criadas em sequencia. */
const STEP = 1000

/**
 * Abaixo deste intervalo, o ponto medio de dois floats64 proximos perde
 * precisao o bastante para duas posicoes poderem colidir. Generoso de
 * proposito: aciona a renormalizacao bem antes do limite real do float64.
 */
const MIN_GAP = 1e-9

/** Primeira posicao de um quadrante vazio. */
export const INITIAL_POSITION = STEP

/**
 * Posicao entre duas vizinhas (qualquer uma pode faltar, nas pontas da lista).
 * `before` e `after` devem vir na ordem de exibicao: `before` fica acima de
 * `after`. Passar os dois invertidos produz uma posicao fora da faixa
 * esperada sem avisar - a chamada precisa garantir a ordem.
 */
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before !== null && after !== null) return before + (after - before) / 2
  if (before !== null) return before + STEP
  if (after !== null) return after - STEP
  return INITIAL_POSITION
}

/** O intervalo entre duas posicoes vizinhas ja esta pequeno demais? */
export function needsRenormalization(before: number, after: number): boolean {
  return after - before < MIN_GAP
}

/**
 * Reatribui posicoes igualmente espacadas, preservando a ordem recebida.
 * Usada quando `needsRenormalization` acusa um intervalo apertado demais -
 * reescreve as tarefas do quadrante de uma vez, em vez de deixar o problema
 * se acumular a cada novo arraste.
 */
export function renormalize<T>(
  items: readonly T[],
  getId: (item: T) => string,
): Map<string, number> {
  const positions = new Map<string, number>()
  items.forEach((item, index) => {
    positions.set(getId(item), (index + 1) * STEP)
  })
  return positions
}
