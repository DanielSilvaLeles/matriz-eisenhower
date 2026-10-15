/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Identificação do build, injetada pelo vite.config.ts. Serve para conferir
 * de relance se o deploy do Pages realmente trocou de versão.
 * São dados públicos de um repositório público - nada sensível aqui.
 */
declare const __BUILD_INFO__: {
  readonly sha: string
  readonly builtAt: string
}
