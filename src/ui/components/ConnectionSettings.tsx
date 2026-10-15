import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { getSyncToken, getSyncUrl, setSyncToken, setSyncUrl } from '@/sync/config.ts'
import { testConnection } from '@/sync/engine.ts'
import { SYNC_ERROR_MESSAGES } from '@/sync/errorMessages.ts'

type TestState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'testing' }
  | { readonly phase: 'ok' }
  | { readonly phase: 'error'; readonly message: string }

/** Secao "Sincronização" das Configurações: URL, token e "Testar conexão" (docs secao 5.8). */
export function ConnectionSettings() {
  const [url, setUrlState] = useState(getSyncUrl)
  const [token, setTokenState] = useState(getSyncToken)
  const [showToken, setShowToken] = useState(false)
  const [testState, setTestState] = useState<TestState>({ phase: 'idle' })
  const urlFieldId = useId()
  const tokenFieldId = useId()

  function handleTestConnection() {
    setTestState({ phase: 'testing' })
    testConnection(url, token)
      .then((result) => {
        setTestState(
          result.ok ? { phase: 'ok' } : { phase: 'error', message: SYNC_ERROR_MESSAGES[result.kind] },
        )
      })
      .catch((error: unknown) => {
        console.error('Falha ao testar conexão', error)
        setTestState({ phase: 'error', message: SYNC_ERROR_MESSAGES.unexpected_response })
      })
  }

  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
        Sincronização
      </h3>

      <label htmlFor={urlFieldId} className="mb-1 block text-xs text-text-muted">
        URL do Apps Script
      </label>
      <input
        id={urlFieldId}
        type="text"
        value={url}
        onChange={(event) => {
          setUrlState(event.target.value)
          setSyncUrl(event.target.value)
        }}
        placeholder="https://script.google.com/macros/s/.../exec"
        autoComplete="off"
        className="mb-3 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-subtle focus-visible:border-focus"
      />

      <label htmlFor={tokenFieldId} className="mb-1 block text-xs text-text-muted">
        Token
      </label>
      <div className="mb-3 flex gap-1.5">
        <input
          id={tokenFieldId}
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(event) => {
            setTokenState(event.target.value)
            setSyncToken(event.target.value)
          }}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[13px] text-text focus-visible:border-focus"
        />
        <button
          type="button"
          onClick={() => {
            setShowToken((value) => !value)
          }}
          aria-label={showToken ? 'Esconder token' : 'Mostrar token'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-text-subtle hover:bg-surface-muted"
        >
          {showToken ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testState.phase === 'testing'}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-text hover:bg-surface-muted disabled:opacity-60"
      >
        {testState.phase === 'testing' ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        Testar conexão
      </button>

      {testState.phase === 'ok' ? (
        <output className="mt-2 block text-xs text-q1-ink">Conexão funcionando.</output>
      ) : null}
      {testState.phase === 'error' ? (
        <p role="alert" className="mt-2 text-xs text-q4-ink">
          {testState.message}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-text-subtle">
        Guardados só neste aparelho. Publicar o script: <code>apps-script/README.md</code>.
      </p>
    </section>
  )
}
