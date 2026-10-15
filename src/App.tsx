import { useEffect } from 'react'
import { MatrixGrid } from '@/ui/components/MatrixGrid.tsx'
import { ThemeToggle } from '@/ui/components/ThemeToggle.tsx'

export function App() {
  useEffect(() => {
    // Pede para o navegador nao limpar o banco local por pressao de espaco
    // (docs secao 6.3). So pedido, nunca garantido: se o navegador recusar
    // ou nao suportar, o app segue normalmente - best-effort e silencioso.
    try {
      navigator.storage.persist().catch(() => {
        // Recusado pelo navegador: nada a fazer, so seguir sem a garantia.
      })
    } catch {
      // API nao suportada neste navegador.
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="text-[13px] font-semibold tracking-tight">
          Matriz de Eisenhower
        </h1>
        {/*
         * O indicador de sincronizacao mora aqui (fase 2). Enquanto nao houver
         * sincronizacao de verdade, nao ha indicador: nunca mostrar
         * "sincronizado" sem ter verificado (docs secao 4.9).
         */}
        <ThemeToggle />
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <MatrixGrid />
      </main>

      <footer className="shrink-0 text-[11px] text-text-subtle">
        <span>
          Versão {__BUILD_INFO__.sha} · {__BUILD_INFO__.builtAt}
        </span>
      </footer>
    </div>
  )
}
