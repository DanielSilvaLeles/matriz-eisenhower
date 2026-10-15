/**
 * App instalado e aberto no modo standalone (sem a barra do navegador) -
 * usado só para rotular a origem da captura como "pwa" em vez de "web"
 * (docs secao 10, `tasks.source`; `InboxItemRow.tsx` mostra "App"/"Web").
 */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}
