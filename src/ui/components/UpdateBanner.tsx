import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * "Nova versão disponível" (docs secao 8): o service worker nunca recarrega
 * a página sozinho - `registerType: 'prompt'` (vite.config.ts) deixa a
 * versão nova esperando até a pessoa clicar aqui. Sem isso, um recarregamento
 * automático no meio de editar uma tarefa perderia o que não foi salvo ainda.
 *
 * `offlineReady` (o service worker terminou de guardar o app em cache, pronto
 * para abrir offline) não precisa de banner nenhum - é só uma confirmação
 * silenciosa de que a instalação funcionou.
 */
export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <output className="fixed inset-x-0 top-3 z-50 mx-auto mt-[env(safe-area-inset-top,0px)] flex w-fit max-w-[calc(100vw-24px)] items-center gap-3 rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[13px] text-text shadow-lg">
      <span>Nova versão disponível.</span>
      <button
        type="button"
        onClick={() => {
          updateServiceWorker(true).catch((error: unknown) => {
            console.error('Falha ao atualizar o service worker', error)
          })
        }}
        className="shrink-0 font-semibold text-focus underline-offset-2 hover:underline"
      >
        Atualizar
      </button>
    </output>
  )
}
