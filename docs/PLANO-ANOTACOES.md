# Plano — Anotações + menu inferior de acesso rápido

Lido por completo `docs/prompt-anotacoes.md` e o código real das áreas que
esta extensão toca (`src/domain/schema.ts`, `src/db/schema.ts`,
`src/db/tasksRepo.ts`, `src/domain/task.ts`, `src/domain/merge.ts`,
`src/domain/syncProtocol.ts`, `src/sync/client.ts`, `src/sync/engine.ts`,
`apps-script/Code.gs`, `src/App.tsx`, `src/ui/shortcuts/useGlobalShortcuts.ts`,
`src/ui/components/MobileMatrixView.tsx`, `src/ui/components/CaptureField.tsx`,
`src/capture.ts`, `src/domain/capture.ts`, `src/db/hooks.ts`,
`src/db/backup.ts`, `src/domain/backup.ts`, `src/ui/store.ts`,
`src/db/device.ts`, `vite.config.ts`, `index.html`,
`.github/workflows/deploy.yml`). Trabalhando na branch `feature/anotacoes`,
modo autônomo, sem perguntas, sem push, sem merge — conforme a seção 1 do
prompt.

## Decisões tomadas antes de codar (justificadas, registradas também em `docs/DECISOES-ANOTACOES.md`)

1. **Um arquivo só (`matriz.json` estendido com `notes`), não `notas.json`
   separado.** A seção 6.3 pede para avaliar e propor; decido manter um
   arquivo só. Separar dobraria a superfície do protocolo (duas revisões,
   duas travas, duas rotações de backup, dois checksums) para um volume
   esperado de "centenas de anotações por ano" — o próprio documento diz
   isso. O ganho de não re-enviar tarefas ao editar uma anotação (e
   vice-versa) é real, mas pequeno nessa escala; o payload inteiro de uma
   pessoa só, com centenas de itens, ainda fica muito abaixo do limite do
   Apps Script. A ação `status` (revision+checksum sem dados) já resolve a
   maior parte do problema de desempenho: evita puxar o arquivo inteiro
   quando nada mudou, que é o caso mais comum.
2. **Sem biblioteca de virtualização nova.** O app inteiro evita
   dependência pesada de propósito (Radix cru em vez do CLI do shadcn,
   textarea simples em vez de editor rico). Para a escala esperada (não
   milhares de anotações), uma lista paginada ("Carregar mais", 50 por
   vez) dá desempenho suficiente sem `react-window`/`react-virtual`.
   Registrado como limitação aceita.
3. **Roteamento por hash sem biblioteca de rotas.** Um store mínimo
   (mesmo padrão de `src/ui/store.ts`, já usado por `selectedTaskIdStore`/
   `triageOpenStore`) ouvindo `hashchange` — três rotas (`#/`,
   `#/anotacoes`, `#/anotacoes/:id`), não precisa de `react-router`.
4. **Tags de anotação extraem para a lista de tags, mas NÃO removem o
   `#tag` do corpo do texto.** A caixa de entrada limpa o título porque é
   uma linha curta; o corpo de uma anotação é o registro da reunião — tirar
   o texto escrito desfiguraria a prova do que foi dito. Reusa o mesmo
   padrão de regex de `src/domain/capture.ts`, função nova que só
   extrai, não substitui.
5. **Migração do schema version 1 → 2**: adiciona a tabela `notes` e o
   campo `tasks.source_note_id`. Teste de migração com fixture no formato
   atual (tarefas v1 sem o campo novo) provando que sobrevivem intactas.
6. **Compatibilidade com o `Code.gs` antigo**: `ping` ganha `version` e
   `capabilities: { notes: boolean }`. Se a resposta não tiver esses
   campos (script antigo), o motor de sync marca `notesSupported = false`
   e só sincroniza tarefas; anotações continuam 100% funcionais só local,
   com o aviso "Script desatualizado…".

## Fases (seção 10 do prompt, em sequência, lint+testes+build ao final de cada uma)

**Fase 1 — Anotações locais + menu inferior.** Tabela `notes` e migração;
domínio puro (`src/domain/note.ts`, `src/domain/noteTags.ts`,
`src/domain/noteMerge.ts` reservado p/ fase 2); repositório
(`src/db/notesRepo.ts`); roteador por hash (`src/ui/router/`); tela de
lista (busca, filtros, agrupamento por dia); editor (autosave 500ms +
blur/visibilitychange/pagehide, "Inserir hora", continuação de lista,
anotação vazia descartada); menu inferior mobile (Matriz/Ideia/Anotar/
Anotações) substituindo a barra de captura fixa; abas + botões + atalhos
(`A`/`L`/`/`) no desktop; atalho de PWA "Nova anotação" (renomeando o
atual, que é "ideia", para não confundir os dois); exclusão com desfazer e
lixeira de 30 dias (reaproveitando o padrão de tombstone que tarefas já
usam). Critério de saída: eu já anoto reuniões, mesmo sem sincronizar.

**Fase 2 — Sincronização de anotações.** Ação `status` no `Code.gs` e no
protocolo; `ping` com `version`/`capabilities`; schema version 2 no
`matriz.json`; mesclagem de anotações com cópia de conflito
(`src/domain/noteMerge.ts`, 6 cenários obrigatórios da seção 6.2); motor de
sync estendido para tarefas E anotações juntas; aviso de script
desatualizado; aviso de tamanho de payload se aproximando do limite;
atualização do `Code.gs` e do README de publicação com o passo de
reimplantar.

**Fase 3 — Elo com a matriz e exportação.** Linhas `[ ]`/`- [ ]` viram
botão "Enviar para caixa de entrada" (leitura) e "Enviar para caixa de
entrada" num trecho selecionado (edição); `source: 'note'` +
`source_note_id` na tarefa criada; marcador trocado para `[→]`, sem
duplicar; link "Ver anotação de origem" no detalhe da tarefa; exportação
em Markdown; inclusão de anotações no backup existente (export/import).

**Item 8 (build para dois repositórios) — depois da fase 3,** porque toca
`vite.config.ts`/`index.html`/`Code.gs` que as três fases já vão ter
estabilizado: `src/appId.ts` central (nome do banco, chaves de
`localStorage`, `cacheId` do service worker, campos do manifest, badge
"BETA"); workflow de deploy disparando em `main` e `master`, calculando
`base`/`VITE_APP_ID` a partir do nome do repositório; `Code.gs` com
`PropertiesService` para nome da pasta/arquivo (padrão = valores atuais);
teste automatizado de isolamento de chaves entre dois app IDs e de
paridade com os nomes atuais de produção; documentação no `CLAUDE.md` e no
relatório.

## Ordem de execução real

1. CLAUDE.md (já atualizado na sessão anterior — confirmado corrente,
   primeiro commit desta branch é esse estado de referência).
2. Este plano.
3. Fase 1 → lint/testes/build → commit.
4. Fase 2 → lint/testes/build → commit.
5. Fase 3 → lint/testes/build → commit.
6. Item 8 → lint/testes/build → commit.
7. `docs/RELATORIO-ANOTACOES.md` e revisão final de `docs/DECISOES-ANOTACOES.md`.

Qualquer bloqueio real (teste que não passa depois de 3 tentativas) fica
registrado no relatório, com o que já funciona commitado, seguindo para o
que não depende dele — por isso os commits são um por fase/funcionalidade,
não um só no final.
