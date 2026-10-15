import { useEffect, useState } from 'react'

const TICK_MS = 60_000

/**
 * Instante atual, atualizado a cada minuto - para "ha quanto tempo esta
 * parado" (docs secao 5.2) nao congelar no valor de quando o painel abriu.
 */
export function useNowTick(): string {
  const [now, setNow] = useState(() => new Date().toISOString())

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date().toISOString())
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  return now
}
