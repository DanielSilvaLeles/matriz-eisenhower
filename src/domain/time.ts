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

/** Dia local (AAAA-MM-DD) de um instante ISO - em fuso local, nao UTC. */
export function localDateOf(isoInstant: string): string {
  const d = new Date(isoInstant)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A virada do dia aconteceu entre os dois instantes (docs secao 5.4: arquivamento automatico do Q4). */
export function hasDayChanged(isoInstant: string, nowIso: string): boolean {
  return localDateOf(isoInstant) < localDateOf(nowIso)
}
