import { useEffect } from 'react'
import { captureItem } from '@/capture.ts'
import { combineSharedText } from '@/domain/shareTarget.ts'
import { INBOX_CAPTURE_FIELD_ID } from '@/ui/components/CaptureField.tsx'

/**
 * Trata dois jeitos de "chegar com intenção" no app (docs secao 8):
 *
 * - **Share target**: outro app compartilhou texto (title/text/url na query
 *   string, conforme o `share_target` do manifest em vite.config.ts) - cai
 *   direto na caixa de entrada pela mesma `captureItem` de qualquer captura.
 * - **Atalho "Nova anotação"** (`?captura=1`): só foca o campo de captura -
 *   com o foco, o teclado do celular abre sozinho.
 *
 * Roda uma vez ao montar o app, e sempre limpa a query string depois
 * (`history.replaceState`) - sem isso, um recarregamento (ou o
 * `beforeunload` cancelado) repetiria a captura ou o foco.
 */
export function useIncomingIntent(): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = combineSharedText({
      title: params.get('title'),
      text: params.get('text'),
      url: params.get('url'),
    })
    const wantsCapture = params.has('captura')

    if (shared !== null) {
      captureItem({ text: shared, source: 'share' }).catch((error: unknown) => {
        console.error('Falha ao capturar conteúdo compartilhado', error)
      })
    }

    if (shared !== null || wantsCapture) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    if (wantsCapture) {
      document.querySelector<HTMLElement>(`#${INBOX_CAPTURE_FIELD_ID}`)?.focus()
    }
  }, [])
}
