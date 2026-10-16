# Relatório — Extensão "Anotações + menu inferior"

Trabalho feito de ponta a ponta em modo autônomo, na branch `feature/anotacoes`,
seguindo a seção 1 de `docs/prompt-anotacoes.md`. **Nenhum commit foi
mesclado nem enviado (`push`) para nenhuma branch** — tudo fica local até
você revisar. Cinco commits, um por fase/funcionalidade:

1. `Fase 1a`/`Fase 1b` (já existentes antes deste relatório) — schema e
   domínio puro de anotações; migração do Dexie v1→v2.
2. `Fase 1c` — roteador por hash, editor com autosave, lista, menu
   inferior do celular, navegação do desktop.
3. `Fase 2` — sincronização de anotações, com compatibilidade obrigatória
   com o `Code.gs` já publicado.
4. `Fase 3` — elo com a matriz (linha de ação → tarefa) e exportação
   (backup + Markdown).
5. `Item 8` — build para dois repositórios (produção + beta).

## 1. O que foi feito, por fase

### Fase 1 — Anotações locais + menu inferior

- **Dados**: tabela `notes` nova no Dexie (schema v2) e `tasks.source_note_id`,
  com migração testada contra uma fixture no formato v1 exato
  (`src/db/migration.test.ts`) — tarefas, pessoas e histórico existentes
  sobrevivem intactos.
- **Domínio puro**: criar/editar/apagar(lógico)/restaurar anotação
  (`src/domain/note.ts`); extração de tags sem remover o `#tag` do texto
  (`noteTags.ts`, decisão registrada); agrupamento por dia e
  busca/filtro com acentos normalizados (`noteGrouping.ts`, `noteSearch.ts`).
- **Roteamento por hash** (`src/ui/router/`): `#/`, `#/anotacoes`,
  `#/anotacoes/:id`, `#/anotacoes/nova` — sem biblioteca de rotas.
- **Editor** (`src/ui/notes/`): salvamento automático com debounce de
  500ms + flush imediato em `blur`/`visibilitychange`/`pagehide`; "Inserir
  hora" (`Ctrl+;`); continuação de lista (`- `/`[ ] `) no Enter; a
  anotação só existe no banco a partir do primeiro caractere digitado.
- **Lista**: busca e filtros (hoje/7 dias/30 dias/tag) instantâneos,
  agrupada por dia, ordenada da mais recente para a mais antiga (padrão,
  com botão para inverter), paginação simples ("Carregar mais").
- **Menu inferior do celular**: uma única barra (Matriz/Ideia/Anotar/
  Anotações) substituindo a antiga barra de captura fixa; "Ideia" abre uma
  folha (sheet) de captura rápida, "Anotar" vai direto para o editor em
  tela cheia. No desktop: abas + atalhos `A` (nova anotação), `L` (lista),
  `/` (busca).
- **Lixeira de 30 dias**: excluir mostra toast "Desfazer"; dentro de
  Histórico, aba "Anotações excluídas".

### Fase 2 — Sincronização

- **Protocolo**: `notes` entra no payload de sync (checksum, push/pull,
  validação no `Code.gs`); ação `status` nova (só `revision`+`checksum`,
  sem dados) — o app pula o pull completo quando nada mudou desde a
  última sincronização confirmada.
- **Mesclagem com cópia de conflito** (`src/domain/noteMerge.ts`): edição
  concorrente genuína de uma anotação NUNCA descarta texto — a vencedora
  (`updated_at` mais recente) fica no lugar original, a perdedora vira uma
  anotação nova ("Título (conflito DD/MM HH:MM do aparelho X)"). Os 6
  cenários exigidos (conflito, edição vs. exclusão, criação em dois
  aparelhos, idempotência, comutatividade, preservação de `created_at`)
  têm teste próprio.
- **Compatibilidade obrigatória com o script antigo** (seção 1.6 do
  prompt): o `Code.gs` devolve `capabilities: { notes: true, status: true }`
  em toda resposta de sucesso; a AUSÊNCIA desse campo é como o app detecta
  um script publicado antes desta extensão. Nesse caso: tarefas continuam
  sincronizando normalmente (checksum/push no formato antigo, sem a chave
  `notes`), anotações ficam só locais e sempre pendentes, com aviso
  discreto no indicador de sincronização — nunca falha, nunca perde dado.
- **Aviso prévio de payload grande**: calculado a cada ciclo, avisa antes
  de chegar perto do limite do Apps Script (2 MB).

### Fase 3 — Elo com a matriz e exportação

- **Linha de ação → tarefa**: uma linha `[ ]`/`- [ ] ` numa anotação
  mostra um botão "→ Caixa de entrada" (lista "Itens de ação" no editor —
  ver decisão sobre não ter um "modo de leitura" separado); ao enviar,
  cria uma tarefa com `source: 'note'` e `source_note_id`, e troca o
  marcador por `[→]` na mesma transação — nunca duplica sem pedir.
- **"Ver anotação de origem"**: no painel de detalhe de uma tarefa que
  nasceu assim, um link volta para a anotação.
- **Backup**: exportar/importar passam a incluir anotações, com parsing
  tolerante a um backup de antes desta extensão (sem a chave `notes`).
- **Exportar anotações em Markdown**: um arquivo `.md` com todas as
  anotações em ordem cronológica, cabeçalho com data/hora de inclusão,
  título e tags.

### Item 8 — Build para dois repositórios (produção + beta)

- `src/appId.ts`: convenção central — **app id vazio (`''`) = produção**;
  toda função ali devolve exatamente os nomes de hoje nesse caso.
  Qualquer outro id (ex.: `matriz-eisenhower-beta`) prefixa o banco Dexie,
  toda chave de `localStorage` (tema, aparelho, URL/token de sync) e o
  `cacheId` do service worker.
- `.github/workflows/deploy.yml` calcula `VITE_BASE_PATH`/`VITE_APP_ID` a
  partir de `github.event.repository.name` e dispara em `main` **e**
  `master`.
- Manifest: `name`/`short_name` passam a "Matriz (beta)"/"Matriz beta";
  `id`/`start_url`/`scope` seguem o `base` calculado (automático).
- Selo "BETA" no cabeçalho quando o app não é o de produção.
- `Code.gs`: `FOLDER_NAME`/`DATA_FILE_NAME` vêm de `PropertiesService`,
  com os literais de produção como padrão; `setupBetaStorage()` configura
  uma cópia de teste isolada.

## 2. O que foi testado, e o resultado

| Camada | Comando | Resultado |
|---|---|---|
| Lint (oxlint, type-aware) | `npm run lint` | ✓ zero avisos |
| Tipos | `npm run typecheck` (`tsc --build --force`) | ✓ zero erros |
| Domínio/banco/UI (Vitest) | `npm test` | ✓ **423** testes |
| Backend simulado (Apps Script) | `npm run test:gas` | ✓ **24** cenários |
| Ponta a ponta (Playwright) | `npx playwright test` | ✓ **28** testes |
| Build de produção | `npm run build` | ✓ sem avisos novos |

Rodado mais de uma vez ao longo do trabalho (gate completo ao fim de cada
fase, mais uma rodada final), sempre com o mesmo resultado. Também
confirmado, à parte: um build completo com `VITE_BASE_PATH`/`VITE_APP_ID`
simulando o repositório beta (`/matriz-eisenhower-beta/`), com o mesmo
suite Playwright passando contra ele, e o `sw.js` resultante sem nenhuma
chamada nova de `setCacheNameDetails` na build de produção (confirmando
"nada muda") e exatamente uma na de beta.

**Dois bugs reais encontrados e corrigidos durante o trabalho** (nenhum
por um teste que já existisse antes desta extensão — ambos achados
revisando o próprio código, não por relato externo):

1. **`isValidData_` (Code.gs) rejeitava um `matriz.json` já existente sem
   a chave `notes`** — a primeira leitura depois de reimplantar o script
   cairia para dados vazios, fazendo tarefas de verdade "desaparecerem"
   da tela (não do Drive — o arquivo continuava intacto). Achado ao
   pensar no caminho INVERSO da compatibilidade pedida pelo prompt (dados
   antigos relidos por um script novo, não app novo falando com script
   antigo). Corrigido tolerando a ausência da chave e normalizando para
   `[]` logo depois de validar. Confirmado que o teste de regressão falha
   sem a correção (reproduz exatamente o desaparecimento) e passa com ela.
2. **`index.html` tinha dois `href` hardcoded** (`favicon.svg`,
   `apple-touch-icon.png`) com `/matriz-eisenhower/` literal — só os
   assets que o Vite injeta (CSS, manifest) seguiam o `base` do build
   automaticamente. Achado compilando com um `base` diferente antes de
   mexer em qualquer configuração real. Corrigido com `%BASE_URL%`.

## 3. Decisões tomadas

Todas registradas, com o motivo completo, em `docs/DECISOES-ANOTACOES.md`
(10 decisões). Resumo das mais relevantes para você revisar:

1. **Um arquivo só no Drive** (`matriz.json` estendido), não
   `notas.json` separado — a ação `status` nova já resolve a maior parte
   do ganho de desempenho que a separação daria, para o volume esperado.
2. **Tags de anotação não removem o `#texto` do corpo** — diferente da
   caixa de entrada, o corpo de uma anotação é o registro literal de uma
   reunião.
3. **Sem biblioteca de virtualização** nem de rotas — paginação simples e
   um store mínimo, consistente com o resto do app.
4. **`CURRENT_SCHEMA_VERSION` não subiu de novo na fase 2** — a versão 2
   (já usada desde a fase 1 para a tabela `notes`) nunca foi publicada
   sem o campo `notes` no protocolo de sync; bater para 3 seria uma
   migração sem propósito real.
5. **`last_confirmed_at` novo em `Meta`**, só para a detecção de conflito
   saber se o servidor mudou uma anotação depois da última sincronização
   confirmada por este aparelho.
6. **Sem "modo de leitura" nem seleção de texto** para o elo com a
   matriz — o botão "→ Caixa de entrada" aparece numa lista própria
   ("Itens de ação") no editor, não dentro de um modo de exibição que o
   app nunca teve.
7. **Detecção de script antigo pela AUSÊNCIA de `capabilities`**, nunca
   por um valor explícito `false` — um script antigo nunca saberia que
   deveria mandar isso.
8. **App id vazio (`''`) = produção** — convenção central do build para
   dois repositórios, mais simples de verificar e mais segura por
   construção (um erro no cálculo cai no comportamento de produção, não
   num prefixo acidental).

## 4. O que depende de você

### 4.1 Nada é urgente — o app funciona sem nenhuma ação sua

Como a compatibilidade com o script antigo é real e testada: você pode
testar esta branch (depois de publicá-la no repositório beta) **sem**
reimplantar o `Code.gs` ainda. Tarefas continuam sincronizando
normalmente; anotações ficam só no aparelho, com um aviso discreto, até
você decidir reimplantar.

### 4.2 Passo a passo para reimplantar o `Code.gs` (quando quiser que anotações sincronizem)

Resumo — o detalhado está em `apps-script/README.md`, seção "Reimplantar
depois de mudar o código":

1. Cole o `Code.gs` novo (deste repositório) no editor do Apps Script,
   substituindo o conteúdo atual.
2. Rode `testChecksum` (menu Executar) e confirme "✓ Bate" no log.
3. Clique em **Implantar → Gerenciar implantações** → ícone de lápis na
   implantação ativa → **Nova versão** → **Implantar**. **Não** crie uma
   implantação nova — isso trocaria a URL, e você teria que atualizar
   todos os aparelhos de novo.

### 4.3 Para publicar uma cópia de teste (beta) isolada da produção

Seção "Publicar uma cópia de teste (beta), isolada da produção" em
`apps-script/README.md`, resumida:

1. Publique uma **cópia separada** do script (projeto novo, nunca
   reaproveitando a implantação de produção).
2. Rode `setupBetaStorage()` nela (grava pasta/arquivo próprios no Drive).
3. **Reimplante** essa cópia (os nomes só valem na próxima execução).
4. Rode `setupToken` nessa cópia (token diferente do de produção) e cole
   a URL + token na tela de Configurações do app rodando o build do beta.

### 4.4 Publicar no repositório beta

Você mesmo faz o push para `matriz-eisenhower-beta` — este agente nunca
fez nem fará `git push`. O workflow (`.github/workflows/deploy.yml`) já
calcula `VITE_APP_ID`/`VITE_BASE_PATH` sozinho a partir do nome do
repositório; não precisa editar nada no código para isso funcionar, só
garantir que o repositório tenha "-beta" no nome (ou ajustar a condição
do workflow, se preferir outro nome).

## 5. Limitações conhecidas (aceitas de propósito)

- **Botão "→ Caixa de entrada" só aparece depois do primeiro autosave**
  (debounce de 500ms) — durante a digitação inicial de uma anotação
  nova, a lista de itens de ação ainda não aparece. Decisão registrada em
  `docs/DECISOES-ANOTACOES.md`, item 8.
- **Sem "modo de leitura" nem seleção de texto** para enviar uma linha
  arbitrária à caixa de entrada — só linhas já marcadas `[ ]`/`- [ ] `.
- **Chave de tema do script de pré-pintura (`index.html`) não é
  prefixada pelo app id** — efeito cosmético só no build do beta (tema
  errado por um instante, corrige no primeiro render do React); nunca lê
  ou escreve o valor de produção.
- **Aproximação de "cópia de conflito"**: a detecção usa um timestamp
  global por aparelho (`last_confirmed_at`), não um retrato por anotação
  — na prática, sempre captura o conflito genuíno; no pior caso (relógio
  do aparelho muito errado — limitação já aceita no projeto desde a fase
  2 original), pode deixar de gerar uma cópia quando geraria idealmente,
  mas nunca perde texto por isso (a regra padrão "mais recente vence"
  ainda se aplica).
- Limitações já aceitas antes desta extensão (relógio pode divergir, sem
  tempo real, push envia o documento inteiro) continuam valendo, agora
  também para anotações.

## 6. Critérios de aceite da seção 11 — cobertura

| # | Critério | Cobertura |
|---|---|---|
| 1 | Cursor no editor com teclado aberto em até 2s | **Parcial automatizado** (foco confirmado por Playwright) — teclado real do celular abrindo é **manual** |
| 2 | Fechar aba/travar/offline não perde texto | **Automatizado** (reload sem blur, `e2e/notes.spec.ts`) |
| 3 | Lista com texto/data/hora, ordenada, busca/filtros offline | **Automatizado** (busca testada; local-first por arquitetura) |
| 4 | Data de inclusão nunca muda | **Automatizado** (domínio + mesclagem) |
| 5 | Única barra inferior, sem cobrir teclado/campo | **Parcial automatizado** (4 itens, some no editor) — "sem cobrir o teclado" é **manual** (teclado virtual real) |
| 6 | "Ideia"/"Anotar" nunca se confundem | **Automatizado** |
| 7 | Duas edições → cópia de conflito, sem perder texto | **Automatizado** (`noteMerge.test.ts` + `engine.notes.test.ts`) |
| 8 | Anotação do celular aparece no PC após "Sincronizar agora" | **Automatizado no motor** (servidor simulado) — **sincronização real entre dois aparelhos é manual** |
| 9 | Linha `[ ]` → tarefa ligada, sem duplicar | **Automatizado** (ponta a ponta) |
| 10 | Conteúdo nunca em URL/log/repo/erro | **Auditoria de código** (nenhum `console.error`/URL inclui corpo de anotação) — sem teste automatizado dedicado |
| 11 | Backup preserva anotações; Markdown abre em qualquer editor | **Automatizado** (backup); Markdown é texto simples, validado por estrutura — abrir visualmente é **manual**, rápido |
| 12 | Testes de domínio e mesclagem passam no CI | **Automatizado** (423 testes, workflow roda a cada push) |

**Resumindo o que só dá para validar manualmente**: teclado do celular
abrindo de verdade (critério 1), a barra inferior não cobrir o teclado
virtual num aparelho real (critério 5), e sincronização de verdade entre
dois aparelhos físicos via o Apps Script publicado (critério 8) — exatamente
os três tipos de coisa que a seção 1.7 do prompt já esperava ("teclado do
celular, instalação do PWA, sincronização real entre aparelhos").

## 7. Roteiro de teste manual (10 minutos)

Pré-requisito: `npm run build && npm run preview`, abrir
`http://localhost:4173/matriz-eisenhower/` no celular e no computador (ou
simular 390px de largura no DevTools).

1. **(1 min) Criar uma anotação pelo celular.** Toque em "Anotar" na
   barra inferior — o teclado deve abrir na hora, cursor no campo. Digite
   "Reunião com fornecedor #teste\n[ ] Cobrar proposta até sexta". Volte
   para "Anotações" — a anotação aparece na lista, com data/hora de
   inclusão.
2. **(1 min) Autosave sem sair do campo.** Digite mais um pouco no corpo,
   NÃO toque em nenhum outro lugar, e recarregue a página direto.
   Reabra a anotação — o texto digitado tem que estar todo lá.
3. **(1 min) Elo com a matriz.** Na mesma anotação, veja a seção "Itens
   de ação" com "Cobrar proposta até sexta" e um botão "→ Caixa de
   entrada". Clique nele. Vá para a Matriz — a tarefa aparece na caixa de
   entrada. Abra o detalhe dela (seta até o checkbox + Enter, ou clique
   no título) — tem um link "Ver anotação de origem"; clique e confirme
   que volta para a mesma anotação, agora com `[→]` na linha.
4. **(1 min) Busca e filtros.** Na lista de anotações, digite "reuniao"
   (sem acento) na busca — a anotação de cima aparece mesmo assim. Limpe
   e filtre por "#teste" na lista de tags.
5. **(2 min) Sincronização real entre os dois aparelhos.** No celular,
   toque em "Sincronizar agora" (ou atalho `S` no PC). No computador,
   sincronize também. A mesma anotação precisa aparecer nos dois lados,
   com "Confirmado" no indicador — sem reimplantar o `Code.gs`, as
   TAREFAS sincronizam normalmente e um aviso "Script desatualizado:
   reimplante a nova versão para sincronizar anotações" aparece
   (ícone de alerta no indicador); depois de reimplantar (seção 4.2
   acima), repita e confirme que a anotação sincroniza também.
6. **(1 min) Conflito.** Com o script já reimplantado: edite a MESMA
   anotação nos dois aparelhos sem sincronizar entre as edições, depois
   sincronize os dois. Confirme que aparecem DUAS anotações na lista — a
   original (com um dos textos) e uma nova "(conflito DD/MM HH:MM do
   aparelho X)" com o outro texto. Nenhum dos dois textos pode ter
   desaparecido.
7. **(1 min) Exportar.** Na lista de anotações, clique no ícone de
   download ("Exportar anotações em Markdown") — confirme que baixa um
   `.md` e que abre corretamente (título, data, tags, texto) em qualquer
   editor de texto.
8. **(1 min) Backup.** Em Configurações → Backup → "Exportar backup" →
   confira no preview de importação que o número de anotações aparece
   junto com tarefas/eventos/pessoas.
9. **(1 min) Instalar como PWA.** No celular, use "Adicionar à tela
   inicial" — confirme que instala com o ícone/nome certos, e que o
   atalho de app (pressionar e manter o ícone) mostra "Nova ideia" e
   "Nova anotação" como opções separadas.
