/**
 * Tempo relativo em portugues - "ha quanto tempo esta parado" na caixa de
 * entrada (docs secao 5.2). Pura: recebe o instante atual como parametro em
 * vez de ler o relogio, para dar entrada fixa em teste.
 */

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function relativeTimeFromNow(isoInstant: string, nowIso: string): string {
  const elapsed = new Date(nowIso).getTime() - new Date(isoInstant).getTime()

  if (elapsed < MINUTE_MS) return 'agora'

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS)
    return `há ${minutes} min`
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return hours === 1 ? 'há 1 h' : `há ${hours} h`
  }

  const days = Math.floor(elapsed / DAY_MS)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

/** Item com mais de 24h na caixa ganha destaque discreto (docs secao 5.2). */
export function isStaleInInbox(isoInstant: string, nowIso: string): boolean {
  return new Date(nowIso).getTime() - new Date(isoInstant).getTime() >= DAY_MS
}
