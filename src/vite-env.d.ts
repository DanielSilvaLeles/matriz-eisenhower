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

/**
 * Build para dois repositórios (`docs/prompt-anotacoes.md` seção 1.8) -
 * injetada pelo workflow de deploy (`.github/workflows/deploy.yml`) a
 * partir do nome do repositório. Ausente (`undefined`) em dev local e no
 * repositório de produção, por convenção - ver `src/appId.ts`.
 */
interface ImportMetaEnv {
  readonly VITE_APP_ID?: string
}
