# Matriz de Eisenhower — guia do repositório

App pessoal de priorização, um único usuário, local-first. Requisitos completos
em `docs/prompt-matriz-eisenhower.md` — esse documento manda; este aqui registra
comandos, convenções e decisões de arquitetura.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | oxlint com regras que usam tipos, zero avisos tolerados |
| `npm run typecheck` | `tsc --build --force` (ver nota abaixo — **não** `tsc --noEmit`) |
| `npm test` | Vitest (domínio, banco, tema, contraste dos tokens) |
| `npm run test:gas` | Harness Node (`apps-script/test/harness.mjs`) que simula os globais do Apps Script e roda `Code.gs` de verdade, sem precisar publicar nada |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em `http://localhost:4173/matriz-eisenhower/` |
| `npx playwright test` | 3 fluxos essenciais ponta a ponta — precisa de `npm run build` antes (roda contra o build de produção via `npm run preview`) |
| `npm run check` | Lint + tipos + testes + `test:gas` + build. É o que o CI roda (o Playwright roda como passo à parte no CI, depois do build). |

## Arquitetura

**Decisão fechada (não reabrir):** a rede da empresa bloqueia a VPS pessoal e
libera apenas GitHub Pages e Google Apps Script. Por isso o front é 100%
estático, o banco local é a fonte da verdade imediata e o Drive (via Apps
Script) é a cópia compartilhada entre aparelhos. Nada de VPS, túnel ou proxy.

```
src/
  appId.ts  convenção central do build para dois repositórios (produção+beta) — ver seção "Publicação"
  domain/   regras puras, sem React, sem banco, sem rede — tudo com teste
    task.ts           criar/mover/reordenar/concluir/reabrir
    taskLifecycle.ts  arquivar, restaurar do histórico, editar campos, ordem por quadrante
    dateStatus.ts     selos Hoje/Atrasada/Cobrar hoje, chips de data da triagem
    delegationMessage.ts  "Copiar mensagem de delegação" (Q3)
    calendarLink.ts   link pré-preenchido do Google Agenda, sem OAuth
    weeklyReview.ts   as quatro métricas da revisão semanal (docs seção 5.9)
    note.ts           criar/editar/apagar(lógico)/restaurar anotação, continuação de lista
    noteTags.ts / noteGrouping.ts / noteSearch.ts  tags, agrupamento por dia, busca/filtro
    noteMerge.ts      mesclagem com cópia de conflito (anotação nunca perde texto)
    actionLines.ts    linhas "[ ]"/"- [ ] " de uma anotação → tarefa (elo com a matriz)
    notesMarkdown.ts  "Exportar anotações em Markdown"
  db/       Dexie: schema, migrations, repositório de tarefas e backup
            changeSignal.ts avisa o sync de uma escrita sem o db conhecer o sync
            peopleRepo.ts   autocomplete de "Para quem?" (docs seção 5.3)
            archiveQ4.ts    arquivamento automático do Q4 na virada do dia
            tasksRepo.lifecycle.ts  editTaskFields/archiveTaskById/restoreTaskFromHistory
            notesRepo.ts / notesRepo.lifecycle.ts / notesRepo.actionLines.ts  mesmo padrão, para anotações
  capture.ts  porta única de captura (docs seção 8), usada pela caixa de entrada
  sync/     ciclo pull -> merge -> push -> verificação (tarefas E anotações)
    client.ts    chamada HTTP de baixo nível (classifica toda falha num motivo)
    engine.ts     o ciclo, o store de status, de-duplicação de chamadas concorrentes,
                  detecção de script antigo (capabilities), pre-check `status`
    engineApply.ts  aplicar o resultado do ciclo + montar o resumo "Confirmado"
    payloadSize.ts  aviso prévio de payload perto do limite do Apps Script
    triggers.ts   quando sincronizar (abrir, foco, 1h, debounce, online/offline, botão)
    config.ts     URL/token — só em localStorage
    errorMessages.ts  mensagem especifica por tipo de erro (docs secao 6.3)
    engine.testHelpers.ts  servidor/localStorage simulados, usado pelos arquivos de teste abaixo
    engine.test.ts             ciclo basico (primeiro sync, pull de outro aparelho, erro, offline)
    engine.raceConditions.test.ts  escrita local concorrente com um ciclo em voo
    engine.notes.test.ts       sync de anotações, conflito, pre-check status, script antigo
  pwa/      intenção de chegada no app (docs seção 8): share target e atalho "Nova anotação"
  ui/
    components/  componentes de apresentação
    notes/        editor/lista de anotações, elo com a matriz (botão "→ Caixa de entrada")
    router/        roteamento por hash (#/anotacoes, #/anotacoes/:id) — docs/prompt-anotacoes.md seção 3.3
    triage/      modo triagem (docs seção 5.3) — store + overlay + passos
    detail/      store do painel de detalhe (docs seção 5.5), compartilhado
    dnd/         DndContext único (desktop + caixa de entrada), ids de contentor
    actions/     orquestração (ex.: mover tarefa + registrar desfazer)
    shortcuts/   atalhos de teclado globais
    undo/        store do toast "Desfazer" (um nível, 6s)
    help/        store do painel de ajuda (atalho `?`)
    hooks/       hooks genéricos (useMediaQuery, useNowTick/useToday, useTheme,
                 useWarnBeforeUnload, useDebouncedCallback — autosave entre digitar e o onBlur)
  lib/      utilitários genéricos
  styles/   tokens de design e CSS global
public/
  icons/      ícones do manifest (.png gerados + .svg fonte, para regenerar sem depender de nada)
e2e/        Playwright — add-and-move-task/sync-cycle/triage/notes.spec.ts (fluxos
            essenciais, docs seção 9), pwa.spec.ts (fase 4), responsive.spec.ts e
            task-detail-autosave.spec.ts (regressões pós-lançamento)
apps-script/  backend no Google Apps Script (Code.gs + README.md de publicação)
  test/       harness Node que simula os globais do Apps Script, sem publicar nada
```

Regra de ouro: **toda regra de domínio é função pura em `src/domain`**. A UI e o
banco só orquestram. É o que torna os critérios de aceite testáveis.

## Decisões de arquitetura

### `npm run typecheck` precisa ser `tsc --build`, não `tsc --noEmit`

**Achado na fase 1c, registrado para não se repetir:** o `tsconfig.json` raiz
usa `"files": []` com `"references"` para `tsconfig.app.json` e
`tsconfig.node.json` (padrão do Vite). Chamar `tsc --noEmit` direto contra
esse arquivo raiz verifica **zero arquivos** - o modo de referências de
projeto só é seguido com `tsc --build`. O script `typecheck` ficou assim por
duas fases inteiras (1a e 1b) sem verificar nada de verdade; o lint e os
testes continuaram pegando a maioria dos problemas, mas nenhum erro de tipo
puro foi checado nesse intervalo. Corrigido para `tsc --build --force`
(o `--force` evita que o cache incremental esconda um arquivo que precisava
ser rechecado). Os `.tsbuildinfo` gerados estão no `.gitignore`.

**Lição:** depois de mudar a config de typecheck de um projeto, confirme que
ela está checando arquivos de verdade (`tsc --noEmit --listFiles | wc -l`),
não só que o comando sai sem erro - comando sem erro e comando que não fez
nada parecem identicos no terminal.

### TypeScript 7 e oxlint (sem ESLint)

`typescript-eslint` 8.71 declara peer `typescript >=4.8.4 <6.1.0` e não suporta
o TS 7. Em vez de segurar o compilador, trocamos o linter: **oxlint +
oxlint-tsgolint** faz lint com informação de tipo usando o mesmo typescript-go
do TS 7, e já traz as regras de `react-hooks` nativamente. Quando o
`typescript-eslint` suportar o TS 7, o ESLint volta a ser opção — hoje não é.

**Pegadinha do TS 7:** a opção `baseUrl` foi removida. Os `paths` do `tsconfig`
resolvem relativos ao próprio arquivo de configuração.

### Tokens de design e acessibilidade

`src/styles/tokens.css` é a **fonte única da verdade das cores**. O tema escuro
sobrescreve as variáveis cruas (por isso `@theme`, e não `@theme inline`: as
utilities precisam apontar para `var(--color-*)` para o tema trocar em tempo de
execução).

Três tokens por quadrante, porque as exigências são diferentes:

- `--color-qN` — gráfico (barra, ícone): WCAG AA pede 3:1
- `--color-qN-ink` — texto: WCAG AA pede 4.5:1
- `--color-qN-soft` — tom levíssimo do cabeçalho: é fundo, não primeiro plano

`src/styles/tokens.contrast.test.ts` lê o CSS e reprova no CI se qualquer par
perder AA. **Trocar cor é seguro: o teste avisa.** Ao criar um fundo novo,
acrescente-o à tabela de verificações do teste.

"Recuar" (Q4) é **afundar em direção ao fundo da página nos dois temas**: use
`surface-sunken`, nunca `surface-muted` — no tema escuro `surface-muted` é mais
claro que `surface` e faria o Q4 saltar, o contrário do pretendido.

### Tipografia

Inter Variable **auto-hospedada**, subconjunto latino (47 KB), em
`src/styles/fonts.css`. Não usamos `fonts.googleapis.com`: a rede da empresa
pode bloquear o domínio e uma fonte externa quebraria o app offline. Numerais
tabulares ligados globalmente, para os contadores `n/10` e as datas não mudarem
de largura ao trocar de dígito.

### Convenção de nomes nos dados

Campos de tarefa em `snake_case` (como a seção 10 do documento) e envelope do
protocolo de sync em `camelCase` (`baseRevision`, `schemaVersion`, seção 6.4).
Sem camada de mapeamento entre os dois: num app de um usuário, é código a mais
sem ganho nenhum.

### Radix direto, não o CLI do shadcn/ui

`components.json` ficou configurado desde a fase 1a, mas o CLI do shadcn
**nunca foi usado**. A fase 1c precisou de menu ("Mover para") e diálogo
(ajuda, backup) — usos de verdade do Radix — e a escolha foi importar
`radix-ui` (o pacote unificado: `import { DropdownMenu, Dialog } from
'radix-ui'`) direto, estilizando com os nossos tokens via `className`, em vez
de gerar os componentes do shadcn. Razão: o CLI do shadcn entrega um visual
genérico pronto que a seção 7 do documento pede para evitar ("não é dashboard
com cards em gradiente"), e os primitivos crus do Radix já dão foco, Escape,
roving tabindex e `aria-*` de graça — não sobra nada de acessibilidade para o
shadcn resolver que justifique herdar o estilo dele. Não precisou mapear os
tokens de alias (`--color-background`, `--color-primary`...) por isso.
`components.json` pode sair do repo quando confirmar que não vai usar o CLI.

### Banco local (Dexie) e o repositório de tarefas

`src/db/schema.ts` declara o schema v1 do Dexie, já no formato final da seção
10 (com os dois ajustes do domínio). O índice composto `[quadrant+status]`
existe porque "tarefas abertas deste quadrante" é a consulta que a tela
inteira faz o tempo todo.

`src/db/tasksRepo.ts` é a única camada que mistura o domínio puro com efeito
colateral (Dexie, relógio, `crypto.randomUUID()`). Cada função é uma
transação: tarefa e evento são gravados juntos, ou nenhum dos dois é. A
camada de domínio (`src/domain/task.ts`) continua pura e testável sozinha,
com `now`, `id` e `eventId` recebidos como parâmetros em vez de gerados
internamente.

`src/db/hooks.ts` usa `useLiveQuery` do `dexie-react-hooks`: toda escrita do
repositório atualiza a tela sozinha, sem gerenciar estado React à mão. É o
que faz "resposta instantânea" (docs seção 4.8) funcionar de graça.

**Nome do aparelho:** até a tela de Configurações existir (fase 2),
`src/db/device.ts` detecta um nome razoável ("celular" ou "computador") pelo
user agent e guarda em `localStorage`. Cada mutação registra o aparelho que
agiu em `tasks.device` — não o que criou a tarefa — porque é esse campo que a
mesclagem de sync usa para desempatar (docs seção 6.2).

**Armadilha de corrida encontrada ao testar no navegador:** o campo
"Adicionar tarefa" limpava o valor só depois que a escrita no Dexie
resolvia. Como a escrita é assíncrona, digitar rápido (ou um teste
automatizado sem pausas) fazia o próximo título cair dentro do campo ainda
não limpo, grudando dois títulos num só. A correção: `AddTaskField` limpa o
campo **antes** de aguardar a gravação, e só devolve o texto se a gravação
falhar. "Mantém o foco para a próxima" (docs seção 5.1) significa o campo
pronto na hora, não só depois que o banco responder.

### Arrastar e soltar (dnd-kit) — um só DndContext, dois bugs reais encontrados

`src/ui/dnd/DndWorkspace.tsx` envolve a matriz inteira *e* a caixa de entrada
num único `DndContext` — tem que ser um só porque um arraste cruza de um
quadrante para outro e da caixa de entrada para um quadrante (docs seção 5.1).
Só sensor de ponteiro (mouse e toque); o sensor de teclado do dnd-kit **não**
está ligado — a alternativa por teclado são os atalhos `1`-`4`/`0` e o menu
"Mover para", que têm semântica própria (ligar os dois ao mesmo tempo criaria
dois jeitos conflitantes de usar as setas). Por isso a alça de arrastar
(`GripVertical`) recebe `tabIndex={-1}` e não espalha `attributes` do
`useSortable` — isso evitaria anunciar a leitor de tela instruções de
arrastar por teclado que não funcionariam de verdade.

Colisão: `pointerWithin` primeiro (o ponto real do cursor — "solto onde meu
dedo está"), com `rectIntersection` como reserva para quando o cursor cai no
vão entre dois quadrantes. **Não** `closestCorners`: ele compara o retângulo
*traduzido* do item arrastado (não o ponto do cursor) contra cada zona
soltável — pego pela alça, que fica na borda esquerda da linha, o retângulo
traduzido não bate com "onde o cursor está visualmente" e o alvo resolvido
surpreende.

Cross-quadrante sempre vai para o **fim** da lista de destino (mesma regra do
atalho de teclado e do menu "Mover para" — os três caminhos têm que se
comportar igual, docs seção 4.5); só o reordenar *dentro* do mesmo quadrante
calcula a posição exata de soltura, em `src/ui/dnd/reorderPosition.ts` (função
pura, testada à parte — usa `arrayMove` do `@dnd-kit/sortable`: soltar sobre
o *índice* de outro item põe a tarefa *naquele índice*, não "entre" aquele
item e seu vizinho antigo — é fácil escrever um teste com a expectativa
errada aqui, like fiz na primeira versão).

**Bug real #1 — zona soltável de 32px.** Um quadrante vazio só renderizava a
frase "Vazio. Ex...." dentro do `<ul>` droppable, que encolhia para
`min-h-8` (32px). A área visualmente vazia do card, abaixo dessa linha, não
era soltável de verdade — testei arrastando e a maior parte dos lugares
"óbvios" para soltar simplesmente não registrava nada. Corrigido: o `<ul>`
ganhou `flex-1` (cresce para preencher o espaço do card), não só `min-h-8`.

**Bug real #2 — duas árvores de layout montadas ao mesmo tempo quebravam o
dnd-kit para Q1.** Até esta fase, `App.tsx` renderizava **as duas** árvores
de layout (desktop `<main>` e `<MobileMatrixView>`) o tempo todo, trocando
qual aparecia só com `sm:hidden`/`hidden sm:flex`. Isso parecia inofensivo
(mesmo truque já usado para os rótulos dos eixos), mas `MobileMatrixView`
inicia com o quadrante `q1` selecionado por padrão — ou seja, ela também
montava uma *segunda* `QuadrantSection` para "Fazer", com seu próprio
`useDroppable({id: 'container:q1'})`, colidindo o id com o do desktop. O
dnd-kit guarda zonas soltáveis num mapa por id; a cópia móvel (escondida,
`display:none`, retângulo de tamanho zero) vencia a competição, e **arrastar
qualquer coisa para "Fazer" no desktop silenciosamente não fazia nada** —
nem o item soltado, nem nenhuma mensagem de erro. O mesmo valia para
`id="inbox-capture"` (dois elementos com o mesmo id no DOM — HTML inválido, e
`document.querySelector('#inbox-capture')` do atalho `N` ficava dependendo de
qual vinha primeiro no DOM).

Como foi encontrado: testar na mão (`claude-in-chrome`) tem fidelidade baixa
para simular arrastar (poucos eventos `pointermove` intermediários — dá para
confirmar que o drag *iniciou*, mas não confiar quando ele *não* termina
onde devia). A confirmação de verdade veio escrevendo os testes Playwright
deste fluxo (`page.mouse.move` em vários passos manuais) e comparando contra
`document.querySelectorAll('[data-task-list="q1"]').length` — voltou `2`.

Corrigido com `src/ui/hooks/useMediaQuery.ts`: `App.tsx` decide **qual**
árvore montar com `matchMedia('(min-width: 40rem)')` (o mesmo valor do
breakpoint `sm` do Tailwind), não as duas com uma escondida por CSS. Esse app
não tem SSR (é 100% client-side), então não existe o risco clássico de
"flash" de hidratação que normalmente desaconselha essa técnica — é só a
escolha certa desde o primeiro frame.

**Lição geral:** nunca monte duas vezes uma árvore que contém `id`s fixos,
hooks do dnd-kit, ou qualquer outro registro global por identificador — nem
"escondida por CSS". Troque a árvore por JavaScript (`useMediaQuery`/media
query real), não por classe `sm:hidden`, sempre que o conteúdo escondido tiver
identidade própria (ids, draggables, listeners globais).

### Desfazer (`src/ui/undo/`) — um nível, não uma pilha profunda

Um toast com "Desfazer" por ~6s (docs seção 4.4) é tudo que existe: não há
modal de confirmação em lugar nenhum do app. `src/ui/undo/store.ts` guarda
**uma** ação pendente por vez (não uma pilha de profundidade N) — bate com a
leitura do atalho global `Ctrl+Z`, que desfaz a *última* ação, não uma
sequência. Uma ação nova sempre substitui a pendente e reinicia os 6s.

**O que gera toast de desfazer:** mover entre quadrantes (drag, `1`-`4`/`0`,
menu "Mover para" — os três caminhos passam por
`src/ui/actions/moveTaskWithUndo.ts`, que é o único lugar que empilha o
desfazer de movimentação) e colar várias linhas na caixa de entrada (desfaz
o lote inteiro, apagando de vez as tarefas recém-criadas via `discardTask` —
seguro porque elas nunca foram trabalhadas nem sincronizadas). **O que não
gera toast:** criar uma tarefa única (reversível na hora, por excluir à mão —
mostrar toast pra isso seria sermão por ação nenhuma) e concluir/reabrir (já
é reversível instantaneamente pelo próprio checkbox — um toast repetiria a
mesma informação). Essa é uma leitura deliberada de "ação destrutiva ou de
movimentação" (docs 4.4), não o único jeito possível de ler a frase.

Restaurar a posição exata (não só o quadrante) usa
`restoreTaskPlacement` — diferente de `moveTaskToQuadrant`, que sempre bota
no fim da lista, o desfazer devolve a tarefa para a posição exata de onde
ela saiu.

### Atalhos de teclado — só os que já têm para onde ir

`src/ui/shortcuts/useGlobalShortcuts.ts` implementa `N`, as setas, `1`-`4`,
`0`, `Ctrl+Z`, `?` e, desde a fase 2, `S` ("sincronizar agora" —
`runSync()`). **De propósito, ainda não implementa** `Enter` ("abrir o
detalhe") nem `T` ("abrir a triagem"): os dois só têm para onde ir na fase 3
(painel de detalhe, modo triagem). Amarrar uma tecla a uma funcionalidade
que ainda não existe seria pior do que não ter o atalho — o painel de ajuda
(`?`) só lista os que funcionam de verdade agora; atualize a lista junto
quando cada funcionalidade chegar.

`Espaço` para concluir **não tem código no atalho global** — de propósito. A
navegação por seta leva o foco ao checkbox da tarefa (`data-task-anchor`), e
o navegador já ativa um checkbox focado com Espaço nativamente; reimplementar
isso só duplicaria (e arriscaria descombinar com) o comportamento nativo.

**Bug real encontrado pelo Playwright, não pelo teste manual:**
`isEditableTarget` (a função que decide "não mexe nos atalhos, a pessoa está
digitando") tratava **qualquer** `<input>` como campo de texto — inclusive um
`<input type="checkbox">` focado! Isso bloqueava `1`-`4`/`0` exatamente no
lugar onde eles mais precisam funcionar: quando o foco (via seta) está no
checkbox de uma tarefa de um *quadrante*. O teste manual no navegador não
pegou isso porque testei o atalho a partir de um item da *caixa de entrada*
(cujo "anchor" de foco é o `<li>`, não um `<input>`) — só o teste automatizado,
focando deliberadamente o checkbox de uma tarefa já num quadrante, expôs o
bug. Corrigido: `isEditableTarget` agora só considera "editável" os tipos de
`<input>` que são de texto de verdade (exclui `checkbox`, `radio`, `button`,
`file`, `range`, `color`...).

**Dois "anchors" de foco diferentes, mesmo contrato `data-task-anchor` +
`data-task-id`:** `TaskRow` usa o próprio `<input type="checkbox">` (já
focável, já ativa com Espaço); `InboxItemRow` não tem checkbox (o item ainda
não foi triado), então o `<li>` inteiro vira o anchor (`tabIndex={0}`,
suprimindo a regra de lint `jsx-a11y/no-noninteractive-tabindex` com
justificativa — é o mesmo padrão de lista navegável sem ação padrão no Enter
que o Gmail usa para a lista de e-mails). A navegação por seta
(`useGlobalShortcuts`) e o cálculo da tarefa focada (`1`-`4`/`0`) não sabem
nem precisam saber qual dos dois é: procuram `[data-task-anchor]` dentro de
`[data-task-list]` e `[data-task-id]` no ancestral mais próximo do elemento
focado, igual nos dois casos.

### Playwright — roda contra o build de produção, um worker só

`playwright.config.ts` usa `webServer` com `npm run preview` (não `npm run
dev`): o que o CI publica de verdade é o build, não o servidor de
desenvolvimento. `workers: 1` de propósito — os testes dividem a mesma
origem e cada um zera o IndexedDB no início (`e2e/fixtures.ts`); rodar em
paralelo faria um teste apagar o banco debaixo do outro.

**`indexedDB.deleteDatabase` não é awaitable por padrão** — devolve um
`IDBOpenDBRequest`, não uma `Promise`. Sem envolver numa `Promise` esperando
o evento `success`, o `page.reload()` seguinte podia abrir o banco antes da
exclusão terminar de verdade, vazando tarefas de um teste para o próximo
(foi exatamente o que aconteceu na primeira versão do fixture: o terceiro
teste via `4` tarefas em vez de `2`).

**Os locators ficam escopados dentro de `<main>`** (o layout desktop) nos
testes — era necessário enquanto as duas árvores de layout estavam sempre
montadas (ver o bug do dnd-kit acima); continua assim mesmo depois do
`useMediaQuery` porque o Playwright roda no viewport padrão (tamanho
desktop) e não há necessidade de reescrever os testes já escritos, mas não é
mais estritamente obrigatório para evitar duplicata de DOM.

### Sincronização (fase 2) — checksum canônico, mesclagem pura, verificação por releitura

**Checksum bit-a-bit idêntico nos dois lados é a peça que faz "Confirmado"
significar algo de verdade.** `src/domain/checksum.ts` (WebCrypto) e
`apps-script/Code.gs` (`Utilities.computeDigest`) implementam a **mesma**
canonicalização — chaves de objeto em ordem alfabética, arrays ordenados por
`id`, sem espaço, `undefined` tratado como ausente — porque qualquer
divergência mínima faz os dois calcularem hashes diferentes para o mesmo
conteúdo e o app nunca mais confirmaria nada. Verificado três vezes
independentes antes de escrever `Code.gs` (um truque de asserção no Vitest
para extrair o JSON canônico, `shasum -a 256` na linha de comando, e um
script Node replicando o JS ao estilo Apps Script) e depois embutido como
fixture fixo (`FIXTURE_HASH`) nos dois lados — `testChecksum()` no `Code.gs`
loga "✓ Bate"/"✗ NÃO bate" contra o mesmo hash que `checksum.test.ts` verifica.
**Se um dos dois lados mudar a canonicalização, o outro precisa mudar igual
— nunca só um.**

**Mesclagem (`src/domain/merge.ts`) é pura e cobre os 6 cenários do
documento** (edição em dois aparelhos, exclusão vs. edição, empate,
ressurreição, idempotência, comutatividade) mais a limpeza de tombstones
com mais de 30 dias. `Person` não tem campo `device` (ao contrário de
`Task`/`TaskEvent`) — o desempate de empate usa `id` em vez de nome do
aparelho só para essa entidade.

**Ciclo do motor (`src/sync/engine.ts`):** pull → mesclar localmente com o
que veio do servidor → se o checksum da mesclagem já bate com o do pull, não
há nada para empurrar (aplica local e confirma); senão, push com
`baseRevision` → **rele o servidor de novo e recalcula o checksum a partir
dessa releitura**, comparando contra o checksum que o cliente pretendia
gravar — só então marca "Confirmado" e limpa as pendências. Nunca confia só
na resposta do próprio push. Conflito (`baseRevision` desatualizado) tenta
de novo desde o pull, até 3 vezes. **Antes de gravar o resultado**
(`applyAndConfirm`), relê o estado local mais uma vez e mescla com o
resultado do ciclo pela mesma regra de "vence o `updated_at` mais recente"
— sem isso, uma edição feita enquanto o ciclo inteiro (pull→push→releitura,
um tempo real de rede) estava em voo era sobrescrita de volta pro valor
antigo assim que o ciclo terminava (bug real, ver "Bug real em produção
(segunda rodada)" abaixo).

**`src/db/changeSignal.ts` existe só para preservar a dependência num
sentido só:** `src/db` não pode importar nada de `src/sync` (o banco não
sabe que sincronização existe), mas toda mutação precisa avisar "algo
mudou" para o debounce de 3s do `src/sync/triggers.ts` disparar. A solução é
um pub/sub mínimo (`notifyLocalWrite`/`onLocalWrite`) que mora em `src/db` e
não conhece `src/sync` — é `src/sync` que se inscreve nele, nunca o
contrário.

**Contador de pendências (`src/db/metaRepo.ts`):** toda função de mutação em
`tasksRepo.ts` chama `markPendingInTx` **dentro da mesma transação** que
grava a tarefa e o evento — a marca de pendência nunca fica fora de sincronia
com o dado que ela descreve. Só `src/sync/engine.ts` limpa (`clearPending`),
e só depois da verificação por releitura acima — nunca ao simplesmente
enviar.

**Harness de teste do Apps Script sem publicar nada
(`apps-script/test/harness.mjs`):** `Code.gs` corre em V8 do jeito que o
Google expõe (`DriveApp`, `PropertiesService`, `LockService`,
`Utilities`, `ContentService`, `Logger` como globais, não módulos). O
harness usa `node:vm` para rodar o código **de verdade** do `Code.gs` com
esses globais simulados em memória (um Drive e um PropertiesService falsos,
mas com a mesma interface). 16 cenários (auth, conflito, encolhimento,
rotação de backup, paridade de checksum) passaram de primeira — ao
contrário da fase 1c (que teve 2 bugs reais), o desenho cuidadoso de
antemão (schema Zod validando a resposta de cada ação, revisão testada
sozinha) não deixou bug nenhum para o teste manual achar depois.

**Lição de fidelidade de teste-duplo, encontrada no `engine.test.ts` e
repetida no Playwright de sync:** um servidor falso que *reimplementa* o
cálculo de checksum em vez de *reusar* `computeChecksum` real sempre acaba
divergindo num detalhe (a primeira versão ordenava os arrays por `id` mas
não as chaves do objeto no nível raiz) — e o sintoma não é um erro óbvio,
é o ciclo inteiro de sync nunca achar o caminho rápido "nada para enviar",
forçando sempre push+verificação mesmo quando os dados são idênticos.
`e2e/sync-cycle.spec.ts` importa `computeChecksum` e os schemas Zod de
`src/domain/` direto (os aliases `@/*` resolvem em tempo de execução do
Playwright, não só no typecheck — `tsconfig.node.json` inclui `e2e/**/*.ts`)
em vez de reimplementar a lógica — a mesma lição, aplicada de novo.

**Settings dividida em três arquivos pelo limite de 300 linhas do lint**
(`max-lines`): `SettingsPanel.tsx` é só a casca do diálogo (nome do
aparelho, tema), `ConnectionSettings.tsx` é a seção de sincronização (URL,
token, "Testar conexão") e `BackupSettings.tsx` é a seção de backup
(lógica movida verbatim do antigo `BackupPanel.tsx`, que este painel
substitui por completo).

### Playwright — fluxo de sync com servidor falso dentro do próprio teste

`e2e/sync-cycle.spec.ts` intercepta `https://script.google.com/**` via
`page.route()` **antes** da requisição saír do navegador — nenhuma URL ou
token real entra no repositório, e o domínio nunca é contactado de
verdade. O servidor falso (estado em closure: `revision` + `data`) mora no
processo do **teste** (Node), não no navegador — é por isso que pode
importar `computeChecksum`/os schemas Zod da aplicação direto, para
fidelidade total com o cálculo real (ver lição acima).

`getByLabel('Token')` sem `{ exact: true }` resolve **dois** elementos: o
próprio campo e o botão "Mostrar token" (o `aria-label` contém a palavra
"token" como substring) — qualquer label futura que seja substring de um
`aria-label` de botão vizinho tem o mesmo risco; prefira `exact: true` para
labels de uma palavra só.

### Bug real em produção: tarefa perdida durante um ciclo de sync

**Relatado pelo usuário já em uso real, depois da fase 5**: uma tarefa
adicionada desapareceu, suspeita de ter acontecido durante uma
sincronização. Causa raiz confirmada: `applyMergedState`
(`src/db/syncRepo.ts`) gravava o estado mesclado com `clear()` seguido de
`bulkAdd()` nas três tabelas. `readLocalState` tira um retrato do banco **no
início** do ciclo (`pull → mesclar → push → reler e verificar`, um tempo
real de rede, não instantâneo); se a pessoa criasse ou editasse uma tarefa
enquanto esse ciclo estava em voo, essa escrita gravava no Dexie na hora
(local-first) mas não entrava no `merged` que esse ciclo específico estava
prestes a aplicar. Quando o ciclo terminava e chamava `applyMergedState`, o
`clear()` apagava a tabela inteira — inclusive a tarefa nova, que nunca
tinha sido lida pelo `pull`/`push` desse ciclo — antes de `bulkAdd()`
regravar só o que estava no snapshot antigo. A tarefa desaparecia sem erro
nenhum, porque do ponto de vista do motor de sync tudo tinha corrido bem.

**Correção:** `bulkAdd()` → `bulkPut()` (grava por cima pelo id, nunca
`clear()` antes) — qualquer id que não esteja em `merged` fica intocado, e
uma escrita concorrente sobrevive para o próximo ciclo buscar. Mesmo
raciocínio aplicado em `clearPending` (`src/db/metaRepo.ts`): limpar
`pending_ids` **inteiro** ao confirmar tinha o mesmo problema (o contador de
pendências mentiria "tudo confirmado" para uma tarefa marcada pendente
*depois* do snapshot) — agora `clearPending` recebe os ids que o próprio
ciclo confirmou (`confirmedIds`, capturados por `readLocalState` no MESMO
instante/transação que o snapshot de tarefas) e só remove esses, por
diferença de conjunto, dentro de uma transação Dexie (elimina também uma
corrida de leitura-e-escrita entre `clearPending` e `markPendingInTx`).

**Lição geral, a mesma do bug de `applyBackup` nunca ter sido escrito assim:**
nunca usar `clear()`/substituição destrutiva para gravar de volta um
snapshot que foi lido no **início** de uma operação assíncrona longa
(ida-e-volta de rede) — qualquer escrita concorrente que aconteça nesse
intervalo é perdida silenciosamente. `applyBackup` (`src/db/backup.ts`)
continua usando `clear()+bulkAdd()` de propósito e não foi alterado: é uma
ação síncrona, confirmada pelo próprio usuário com um clique num botão com
sua própria UI de confirmação, não um ciclo de fundo silencioso — perfil de
risco completamente diferente.

**Pedido do usuário, atendido junto:** reduzir a frequência da sincronização
automática por tempo (`src/sync/triggers.ts`), de 60s para 1 hora — o
restante dos gatilhos (abrir, foco, 3s após editar, reconexão,
botão/atalho `S`) continua, porque são disparados por evento, não por
sondagem às ciegas. Note que o pedido original foi motivado pelo susto do
bug acima, não pela frequência em si — o bug já estava corrigido antes dessa
mudança, mas o espaçamento ficou de qualquer forma, por ser razoável para
um app de um usuário só.

Teste de regressão em `src/sync/engine.test.ts` ("tarefa criada DURANTE o
ciclo..."): usa um `fetch` simulado que trava a chamada de `push` num
gate controlado pelo teste, cria uma segunda tarefa enquanto o push está
preso, solta o gate, e confirma que as duas tarefas sobrevivem e que a
tarefa concorrente continua marcada pendente (não foi sincronizada por
este ciclo — vai no próximo).

### Bug real em produção (segunda rodada): mover uma tarefa durante o sync desfazia o movimento

**Relatado pelo usuário, depois da correção acima já estar no ar**: "quando
movimento um item de um quadrante para outro ou para a caixa de entrada
durante a sincronização, ele não salva essa movimentação e o item volta
para o quadrante anterior." Mesma família de bug do anterior (escrita local
durante um ciclo de sync em voo), mas uma variante que o `bulkPut` **não**
cobria.

**Causa raiz:** o `bulkPut` de `applyMergedState` só protege uma tarefa que
está **ausente** de `merged` (o bug anterior - tarefa nova, nunca lida pelo
snapshot). Mover uma tarefa **já existente** é diferente: o id dela já
estava no snapshot e continua presente em `merged` - só que com o
quadrante **antigo**, porque `merged` foi calculado a partir do estado de
`readLocalState` no início do ciclo, antes do movimento acontecer.
`bulkPut(merged.tasks)` grava por cima **todo** id presente em `merged`,
inclusive esse - desfazendo o movimento silenciosamente assim que o ciclo
terminava, mesmo com a correção anterior já aplicada.

**Correção:** `applyAndConfirm` (nova função em `engine.ts`, chamada pelos
dois pontos de saída bem-sucedida do ciclo - "nada para empurrar" e
"push+verificação OK") relê o estado local de novo **bem perto da
escrita**, bem depois do push/verificação já terem acontecido, e mescla
esse estado fresco com `merged` usando a MESMA `mergeState` (vence o
`updated_at` mais recente) já usada para toda mesclagem local-vs-remoto no
app - o movimento em voo, por ter o `updated_at` mais novo, sempre vence.
A pendência dessa tarefa específica não é limpa (`taskUnchanged` compara o
valor final com o que foi efetivamente confirmado com o servidor neste
ciclo) - continua marcada pendente pro próximo ciclo empurrar de verdade,
em vez do contador mentir "tudo confirmado".

**Por que o teste do bug anterior não pegou este**: aquele criava uma
tarefa **nova** (ausente de `merged` por definição) - o `bulkPut` já
resolvia isso sozinho. Este move uma tarefa **que já estava la antes do
ciclo começar** - só reconhecido com um teste que sincroniza a tarefa uma
vez primeiro (pra ela estar "estável", o cenário real do usuário) e só
depois dispara um segundo ciclo que ela é movida no meio dele. Dois testes
de regressão diferentes para duas variantes diferentes do mesmo tipo de
corrida - nenhum teste cobre o outro.

Teste de regressão em `src/sync/engine.raceConditions.test.ts` ("mover uma
tarefa JA EXISTENTE..."), ao lado do teste da fase anterior (os dois
arquivos foram separados aqui, `engine.test.ts` +
`engine.raceConditions.test.ts` + `engine.testHelpers.ts`, só pelo limite
de 300 linhas do lint ao crescer).

### Mudança pedida pelo usuário: titulo da tarefa abre detalhe, so o checkbox conclui

`TaskRow.tsx` envolvia checkbox e titulo no mesmo `<label>` — padrao HTML
nativo onde clicar em **qualquer parte** do label (inclusive o titulo)
ativa o controle associado, nesse caso o checkbox. Na pratica isso
significava clicar no titulo da tarefa, so para ler ou abrir o detalhe,
concluia a tarefa por engano. Pedido explicito do usuario: separar as duas
acoes. Corrigido removendo o `<label>` compartilhado — o checkbox ficou
solto (so ele conclui/reabre), e o titulo virou seu **proprio** `<button>`
que chama `selectedTaskIdStore.set(task.id)`, a mesma acao do botao
"Ver detalhe" (icone `PanelRight`) mais a frente na linha, so que como alvo
principal em vez de um icone secundario que só aparece em hover. O alvo de
toque de 48px (docs secao 5.7) migrou do `<label>` para esse novo botao
(`min-h-12`), preservando a área clicável original.

O botao do titulo nao leva `aria-label` — o nome acessivel vem do proprio
texto visivel dentro dele, para nao duplicar a mesma frase
("Abrir detalhe de ...") em dois controles com a mesma acao na mesma linha
(o botao de icone `PanelRight` continua com `aria-label`, por ser
icone-only).

Teste de regressao em `e2e/add-and-move-task.spec.ts` ("clicar no titulo
abre o detalhe..."): clica no titulo, confirma que o dialogo de detalhe
abre, fecha com `Escape`, confirma que o checkbox continua desmarcado, e só
então marca o checkbox e confirma que a tarefa foi concluída de verdade.
**Achado ao escrever esse teste:** Radix marca o resto da pagina
`aria-hidden` enquanto o dialogo esta aberto — qualquer asserção sobre o
checkbox por tras dele precisa vir depois do `Escape`, senao
`getByRole('checkbox', ...)` nao encontra nada (nao é "nao achou porque
nao existe", é "nao achou porque esta fora da arvore de acessibilidade").

### Bug real em produção: segundo item da triagem "não fazia nada"

**Relatado pelo usuário**: triar o primeiro item da caixa de entrada
funcionava, mas ao triar o segundo "ele sempre voltava, parecia que não
tinha feito nada". Causa raiz: uma corrida entre o clique/tecla e a
movimentação assíncrona no Dexie. `handleDigit` (`TriageOverlay.tsx`)
capturava `current`, chamava `setPendingTask(task)` e disparava
`moveTaskToQuadrant` (uma transação Dexie, não instantânea) - mas `mode`
só mudava (para `'date'`/`'delegate'`, ou de volta para `'item'` via
`finishStep`) **depois** que essa movimentação resolvia. Nesse intervalo,
`mode` continuava `'item'` e `current` continuava apontando para o MESMO
item (ele só sai de `inboxTasks` quando a escrita termina) - então nada
impedia um segundo clique num botão de quadrante, ou uma segunda tecla
`1`-`4`/`E`/`S`, de capturar o mesmo `current` outra vez e disparar uma
**segunda** movimentação concorrente para o mesmo item. Como as duas
transações do Dexie usam as mesmas tabelas, elas são serializadas - a
segunda sempre vence por último - mas a sua resolução (`onDone`/
`onNeedsFollowUp`) chegava **depois** e sobrescrevia o `mode`/
`pendingTask` que a primeira tinha acabado de definir. Resultado visível:
o passo que a primeira escolha deveria abrir nunca ficava visível (ou
desaparecia na hora), e o item parecia "voltar" - típico de um duplo clique ou
duplo toque de tecla por impaciência, já que os botões de destino não
davam nenhum feedback imediato de "já registrei seu clique".

**Correção:** `busy` (`pendingTask !== null`) agora é checado em TODOS os
pontos de entrada que iniciam uma ação sobre o item atual - `handleDigit`,
`handleHelp`, `handleEdit`, `handleSkip`, e o guard de teclado
(`handleKeyDown`). Como `pendingTask` fica preenchido do início de
`handleDigit` até `finishStep` (inclusive durante os passos de
data/delegação), esse intervalo inteiro vira efetivamente "ocupado" -
nenhuma segunda ação para o mesmo item consegue entrar enquanto a primeira
não terminar. `TriageItemStep` ganhou a prop `busy` para desabilitar e
esmaecer os botões nesse intervalo - não só fecha a corrida, também dá o
feedback visual imediato que faltava (o clique "sumiu" sem reação
nenhuma era exatamente a sensação de "não fez nada" que o usuário
relatou).

**Lacuna de teste descoberta junto:** nenhum teste (automatizado ou
manual) tinha triado **dois** itens em sequência - todos os testes de
`e2e/triage.spec.ts` paravam no primeiro. `e2e/triage.spec.ts` ganhou dois
testes: um cobrindo o fluxo normal de dois itens em sequência (a lacuna de
cobertura em si), e outro disparando duas teclas de destino em sequência
sem esperar (`Promise.all` nos dois `page.keyboard.press`) para exercitar
a trava diretamente - confirmado que esse segundo teste **falha** sem a
correção (o item termina em dois quadrantes/nenhum lugar certo) e passa
com ela.

### Triagem, detalhe e histórico (fase 3) — dois bugs reais encontrados

**Bug real #1 — o botão "Mover" ficava invisível fora de uma `TaskRow`.**
`MoveToMenu.tsx` estiliza o próprio gatilho com `sm:opacity-0
sm:group-hover:opacity-100` — só aparece em hover/foco a partir do
breakpoint `sm`, e só quando existe um ancestral com a classe `.group`
(Tailwind). Em `TaskRow.tsx` esse ancestral é a própria `<li className="group
...">`, então funciona. Mas o `TaskDetailPanel.tsx` (painel de detalhe,
docs 5.5) e o `HistoryPanel.tsx` (histórico, docs 5.9) reusam o mesmo
`MoveToMenu` dentro de um cabeçalho/linha **sem** essa classe — o botão
ficava no DOM, funcional ao toque (mobile sempre mostra, `opacity-100` até
`sm`), mas **permanentemente invisível em telas largas**, porque a condição
de hover nunca tinha um `.group` para disparar. Encontrado só no teste
manual no navegador (o Playwright não cobre esses dois painéis ainda,
e o bug é puramente visual — nada quebra, só não aparece). Corrigido
acrescentando `group` ao `<header>` do painel de detalhe e ao `<li>` de
cada linha do histórico. **Lição:** qualquer componente que reusa
`MoveToMenu` (ou outro filho com `sm:group-hover:opacity-100`) fora de uma
`TaskRow` precisa lembrar de prover o `.group` ele mesmo — o componente não
avisa, só fica mudo.

**Bug real #2 — o último item da triagem podia pular o passo de
data/delegação.** `TriageOverlay.tsx` decidia o que renderizar nesta ordem:
"caixa vazia?" primeiro, depois os passos (`date`/`delegate`/`help`/`edit`),
por último o item normal. Mover o **último** item da caixa para Q2/Q3 esvazia
`useInboxTasks()` no mesmo instante em que o modo muda para `'date'`/
`'delegate'` — e a tarefa pendente vinha de `useTask(activeTaskId)`, uma
releitura assíncrona do Dexie que ainda não tinha resolvido nesse primeiro
render. Resultado: a checagem "caixa vazia" (que não dependia de nada
assíncrono) vencia a corrida, e a tela de "Caixa de entrada zerada!" aparecia
**sem nunca mostrar o passo de data/delegação** para o último item — a
pessoa perdia a chance de dar a data ou escolher a pessoa logo ali.
Encontrado pelo Playwright (`e2e/triage.spec.ts`), não pelo teste manual
(que sempre testou com mais de um item na caixa, onde a corrida não
acontece). Corrigido de duas formas, juntas: (1) o estado "tarefa pendente"
guarda o **objeto `Task` capturado na hora do clique/tecla**, não só o id —
elimina a releitura assíncrona por completo, o passo tem os dados na mesma
tarefa com que a pessoa interagiu; (2) a ordem de verificação na JSX mudou
para checar os passos de acompanhamento **antes** da checagem de "vazio",
como defesa em profundidade. **Lição:** numa máquina de estados que reage a
uma lista ao vivo (`useLiveQuery`), nunca decida "terminou" só porque a
lista esvaziou — pode haver um passo pendente que ainda depende do item que
acabou de sair dela.

**Máquina de estados da triagem**, sem fila congelada: sempre processa o
item mais antigo da caixa (`useInboxTasks` já ordena assim) que ainda não
foi pulado nesta sessão (`skipped: string[]`, reiniciado só quando a
triagem reabre). "Pular" (tecla `S`) é por sessão, não permanente — fechar e
reabrir a triagem esquece os pulos. O progresso "N de M" vem de
`initialTotal` (quantos itens havia quando abriu) menos o que sobrou na
caixa agora — não um índice de fila.

**Resetar estado ao trocar de prop, sem `useEffect`:** tanto
`TriageOverlay` (reiniciar ao abrir) quanto `TaskDetailFields` (campos
começarem do zero ao trocar de tarefa) precisavam "resetar quando X muda".
Para `TaskDetailFields`, a solução é o padrão oficial do React: o pai
(`TaskDetailPanel`) passa `key={task.id}`, e trocar de tarefa **remonta** o
componente do zero — sem efeito nenhum. Para `TriageOverlay` (precisa
resetar vários `useState` ao mesmo tempo, não um componente inteiro), o
padrão é comparar o valor anterior durante a própria renderização
(`if (open !== wasOpen) { setWasOpen(open); ... }`) e chamar `setState`
ali mesmo - permitido pelo React quando é síncrono e correndo durante o
render, ao contrário de um `useEffect` com `setState` dentro (que o oxlint
recusa com `set-state-in-effect`: dispara um ciclo de render a mais,
geralmente evitável).

**Atalhos de teclado da triagem colidem com os globais, de propósito
resolvido com `stopPropagation`:** dentro do modo triagem, `1`-`4`/`E`/`S`
significam coisas diferentes do que significam na matriz (mandar para
quadrante, editar, pular — não mover a tarefa *focada* nem sincronizar). O
`onKeyDown` do `Dialog.Content` da triagem escuta esses mesmos eventos
antes de `useGlobalShortcuts.ts` (que ouve em `window`), e chama
`event.stopPropagation()` nos que trata — sem isso, `S` dentro da triagem
também disparava `runSync()` (o atalho global de sincronizar), um efeito
colateral que nada tinha a ver com a intenção da pessoa. `isEditableTarget`
foi exportado de `useGlobalShortcuts.ts` para a triagem reusar a mesma
regra "não é campo de texto".

**`sortTasksForQuadrant` (docs 5.4): só Q2 ordena por data**, não-datadas no
fim; os outros três quadrantes continuam por posição manual (arrastar,
teclado, menu "Mover para"). Isso significa que **arrastar para reordenar
dentro de Q2 não tem efeito visual** — a posição salva, mas a tela sempre
reordena por data no próximo render. Não implementado como bloqueio (o
dnd-kit continua funcionando para mover *entre* quadrantes), só a
reordenação dentro de Q2 não "gruda" - decisão deliberada: a seção 5.4 pede
"ordenada por data", não "ordenada por data, exceto quando a pessoa
arrastar".

**"Esta semana"/"Semana que vem" nos chips de data da triagem** (docs 5.3)
não têm regra fixa no documento, só os rótulos. Leitura escolhida em
`src/domain/dateStatus.ts`: semana de segunda a domingo; "esta semana" é a
sexta-feira da semana corrente (ou da seguinte, se hoje já passou da
sexta); "semana que vem" é a segunda-feira seguinte. Documentado ali para
não surpreender quem reabrir o código depois.

**`editTaskFields` nunca gera `task_events`** (diferente de mover, concluir,
reabrir, arquivar): os tipos em `TASK_EVENT_TYPES` (docs seção 10) não
incluem "editado" — mudar notas/data/delegação/tags é só uma atualização de
campo, não um evento de histórico. A linha do tempo do painel de detalhe
(docs 5.5) mostra só os eventos de verdade.

**`people` só alimenta autocomplete**, nunca é referência: `delegated_to`
continua `string` (o nome em texto livre, como a seção 10 pede), e
`ensurePersonInTx` (chamado de dentro de `editTaskFields`/`tasksRepo`) só
garante que o nome existe em `people` para aparecer no `<datalist>` da
próxima vez — comparação sem diferenciar maiúsculas/minúsculas, para "Ana"
e "ana" não virarem duas pessoas.

**Arquivamento automático do Q4** (`src/db/archiveQ4.ts`) roda uma vez ao
abrir o app (`App.tsx`), comparando o dia local de `updated_at` de cada
tarefa aberta de Q4 com o dia de hoje — não um cron nem um `setInterval` à
meia-noite: para um app de um usuário só, "da próxima vez que a pessoa olhar
a tela" é suficiente, e evitar um temporizador de fundo é mais simples e
não gasta bateria à toa. "N eliminadas esta semana" conta por
`task_events` (tipo `archived`, `at` desde a segunda-feira), não por
`tasks.status === 'archived'` — o status não diz *quando*, só *que*; o
evento é exatamente o que a seção 10 descreve `task_events` para fazer
("revisão semanal").

**Arquivos divididos só pelo limite de linhas/dependências do lint, não por
fronteira de domínio real** (registrado para não confundir quem procurar
uma função e não achá-la "onde devia estar"): `src/domain/task.ts` →
`taskLifecycle.ts` (archiveTask/restoreTask/editTaskFields/
sortTasksForQuadrant), `src/db/tasksRepo.ts` → `tasksRepo.lifecycle.ts`
(as versões com efeito colateral dessas mesmas três), `TaskDetailPanel.tsx`
→ `TaskDetailFields.tsx` (os campos editáveis), `TriageOverlay.tsx` →
`TriageItemStep.tsx` + `TriageEditStep.tsx` + `TriageFollowUpSteps.tsx`
(data+delegação, um arquivo só pelo limite de *dependências*, não linhas),
`App.tsx` → `AppHeaderActions.tsx` + `GlobalOverlays.tsx` (só para não
estourar `import/max-dependencies`, 16 módulos).

### Playwright — fluxo de triagem

`e2e/triage.spec.ts` cobre o atalho `T`, `1`-`4`, "Me ajude a decidir" e a
tela de caixa zerada. O atalho global `T` só age fora de campo editável
(`isEditableTarget`) — depois de `captura.press('Enter')` o foco **continua**
no próprio campo de captura (de propósito, para "mantém o foco para a
próxima" funcionar — docs 5.1/5.2), então o teste precisa clicar em outro
lugar neutro (o `<h1>`) antes de `T`, senão a tecla só é digitada no campo.
Depois de abrir a triagem por `T`, o primeiro atalho de teclado (`1`-`4`)
também precisa de um clique dentro do diálogo antes — o foco do Radix
Dialog pode não ter terminado de entrar no conteúdo a tempo do primeiro
`keydown` sintético do Playwright, uma corrida que não aparece ao testar
na mão (onde sempre há alguns milissegundos entre abrir e a próxima tecla).

### PWA (fase 4) — manifest explícito, update sob demanda, um bug real no share target

**`vite-plugin-pwa` com `registerType: 'prompt'` e `injectRegister: null`:**
o documento (secao 8) pede para o service worker **nunca** recarregar a
página sozinho, só avisar "Nova versão disponível" - `'prompt'` é o que faz
a versão nova ficar esperando até a pessoa confirmar (`autoUpdate`
recarregaria sozinho, inaceitável no meio de uma edição não salva).
`injectRegister: null` desliga o script de registro automático que o
plugin injetaria no `index.html`; o registro acontece pelo nosso próprio
código, via `useRegisterSW()` de `virtual:pwa-register/react` dentro de
`UpdateBanner.tsx` - assim o banner "Nova versão disponível" e o registro
do service worker são a mesma peça, sem um hook escondido registrando por
trás.

**Todo campo do manifest com o subcaminho por extenso**
(`${BASE_PATH}icons/icon-192.png`, não só `icons/icon-192.png`): a mesma
lição da fase 1a (manifest/`start_url`/`scope` têm que seguir o
subcaminho do Pages) - `vite-plugin-pwa` até resolveria boa parte sozinho
a partir do `base` do Vite, mas ser explícito aqui evita descobrir um
ícone quebrado só depois de publicar, exatamente o tipo de problema que a
seção 11 avisa ("é onde esse tipo de configuração costuma falhar").

**Ícones gerados com `sharp`, mas `sharp` não é dependência do projeto:**
sem `convert`/`rsvg-convert`/`inkscape` disponíveis, os PNGs
(`public/icons/*.png`) foram rasterizados a partir de SVGs-fonte com
`sharp` instalado **temporariamente** (`npm install --no-save`), depois
removido (`npm uninstall`). Os SVGs-fonte (`icon.svg`, `icon-maskable.svg`,
`shortcut-capture.svg`) ficam versionados em `public/icons/` para
regenerar os PNGs no futuro sem precisar resolver essa dependência de novo
- qualquer ferramenta de SVG→PNG serve, o projeto não depende de nenhuma
em particular.

**Bug real: `combineSharedText` juntando os campos com quebra de linha
fazia um compartilhamento virar três tarefas, não uma.** `captureItem`
trata cada linha do texto como um item separado - é assim que "colar
várias linhas vira um item por linha" funciona (docs secao 5.2). O share
target entrega título, texto e URL como campos separados
(`src/pwa/useIncomingIntent.ts`), e a primeira versão de
`combineSharedText` (`src/domain/shareTarget.ts`) os juntava com `\n`,
sem perceber que estava alimentando o mesmo splitter de colagem
multilinha - compartilhar uma página virava três itens na caixa de
entrada (título, texto e URL cada um separado) em vez de um só.
Encontrado testando na mão (claude-in-chrome, navegando direto para
`?title=...&text=...&url=...`), não nos testes automatizados - o teste em
`shareTarget.test.ts` conferia o conteúdo combinado, mas não pensava em
como esse conteúdo seria consumido depois. Corrigido trocando o separador
para `" — "` (nunca quebra de linha) e documentado em
`e2e/pwa.spec.ts`, que confere explicitamente que vira **uma** tarefa.

**Lição de metodologia, descoberta no meio da investigação deste bug:**
reusar a mesma aba do navegador entre `force: true` (descartar o diálogo
de "sair da página?") repetidos pode deixar o bundle JS **desatualizado**
sem avisar - a aba continuava servindo um JavaScript de antes do rebuild
mais recente, fazendo um teste manual parecer confirmar "nada acontece"
quando na verdade o código novo nunca chegou a rodar. A pista: o
`document.querySelector('script[src]')` mostrava o hash do bundle
**antigo** muito depois de reconstruir. Corrigido abrindo uma aba nova
para cada navegação que importa carregar o build mais recente, em vez de
reusar uma aba com histórico de `beforeunload` descartado.

**Indicador "Offline" na hora, sem esperar uma tentativa de sincronização**
(docs secao 6.3 e 8): `src/sync/triggers.ts` já tinha um listener para
`online` (dispara um ciclo de sync ao reconectar), mas nada para
`offline` - o indicador só saberia que a rede caiu na PRÓXIMA vez que
algum gatilho tentasse sincronizar e falhasse. Um `window.addEventListener
('offline', ...)` que escreve `{ kind: 'offline' }` direto no
`syncStatusStore` resolve isso sem precisar de nenhuma tentativa de rede -
"honesto" na hora, não só eventualmente.

**Teste de offline de verdade, não simulado:** `e2e/pwa.spec.ts` usa
`context.setOffline(true)` do Playwright - desliga a rede de verdade
naquele contexto de navegador, não troca nenhuma flag da aplicação. O
teste de "funciona offline" só é válido se o app realmente não conseguir
alcançar a rede, não se a gente *finge* que não consegue.

### Playwright — PWA

`e2e/pwa.spec.ts` cobre o que dá pra automatizar do "teste de instalação
do PWA no subcaminho" que a seção 11 pede: manifest válido com
`start_url`/`scope`/ícones certos, o app funcionando depois de
`context.setOffline(true)` + recarregar, o indicador "Offline" aparecendo
sem esperar uma tentativa de sync, e os dois jeitos de "chegar com
intenção" (share target vira uma tarefa só, `?captura=1` foca o campo).
**Instalar de verdade é um fluxo do sistema operacional** - não dá (nem
faria sentido) automatizar isso; os critérios que o navegador checa para
*oferecer* a instalação (manifest válido, ícones 192/512, service worker
ativo) são o que fica testável e é exatamente o que este arquivo confere.

### Revisão e refinamento (fase 5) — dois bugs reais de contraste, achados por matemática, não por olho

**Revisão semanal** (docs secao 5.9): uma aba nova dentro do próprio
`HistoryPanel.tsx` (não um painel separado - a seção 5.9 do documento já
agrupa "Histórico e revisão" como um conceito só, e o cabeçalho já tinha
ícones demais para caber mais um em 360px). `src/domain/weeklyReview.ts` é
puro e cobre as quatro métricas pedidas:

- **Distribuição de concluídas por quadrante**: `tasks.status === 'done'`
  com `completed_at` desta semana, agrupado por `quadrant`.
- **Quantas chegaram em Q1 vindas de Q2 atrasado**: aproximação documentada
  no próprio código - não existe um retrato histórico do campo `date` no
  `task_events`, só o quadrante de origem/destino. A contagem compara a
  data **atual** da tarefa com o dia da movimentação; se a data foi editada
  depois de chegar em Q1, o número pode não refletir mais a realidade
  daquele momento. Aceitável para um sinal de "a Q1 está vivendo de
  apagar incêndio" (docs seção 3, princípio 1) - não precisa ser perfeito,
  precisa ser um alerta.
- **Tempo médio parado na caixa de entrada**: só de quem *saiu* dela
  (evento `moved` com `from_quadrant: null`) nesta semana - `created_at`
  até o instante do evento. `null` quando nada foi triado ainda.
- **Eliminadas esta semana**: mesma lógica de `useEliminatedThisWeek`
  (fase 3), mas computada de novo dentro do mesmo `computeWeeklyReview`
  para a revisão trazer os quatro números de uma vez só.

**Dois bugs reais de contraste no tema escuro, achados calculando as
razões (não só olhando a tela)**: `--color-focus` e `--color-q4` nunca
foram calibrados para servir de **fundo sólido com texto branco em cima**
- só para anel de foco (`--color-focus`, precisa 3:1 contra a superfície) e
gráfico/ícone (`--color-qN`, idem). No tema escuro os dois ficam claros
demais para esse papel:

- `bg-focus` + `text-white"` (badge de contagem da caixa de entrada,
  botões "Mandar"/"Confirmar"/"Salvar" da triagem): `--color-focus` no
  escuro é `#7fb0f5` (pastel, de propósito - precisa **contrastar** com a
  superfície escura). Branco em cima disso dá **2.2:1** - bem abaixo do
  4.5:1 que AA exige. `tokens.contrast.test.ts` nunca pegou isso porque só
  testava `--color-focus` como anel/borda, nunca como fundo de botão.
- `bg-q4` + `text-white` (botão "Substituir" ao importar backup):
  `--color-q4` no escuro é `#e26a6a`, dá **3.2:1** com branco - também
  abaixo de 4.5:1.

Corrigido com dois tokens novos, só para esse papel (`tokens.css`):
`--color-accent`/`--color-accent-ink` (botões primários) e
`--color-danger`/`--color-danger-ink` (botão destrutivo) - calibrados
especificamente para 4.5:1 com o texto que vai em cima, em vez de
reaproveitar um token pensado para outra finalidade. `tokens.contrast.test.ts`
ganhou os dois pares na lista de verificações, para a próxima pessoa que
inventar um botão de fundo sólido não repetir o erro sem o CI avisar.
**Lição:** um token de cor "serve" visualmente em vários lugares, mas só
está *provado* AA onde o teste de contraste realmente o testa - adicionar
um uso novo para um token existente (fundo + texto, em vez de
anel/gráfico) é adicionar uma afirmação de acessibilidade nova, que
precisa da própria verificação.

**Um bug real de foco invisível**: `AddTaskField.tsx` (o campo "Adicionar
tarefa" sempre visível de cada quadrante) tinha `focus:outline-none` sem
nenhum substituto - ao contrário de `CaptureField.tsx`, que troca o anel
por `focus-visible:border-focus`. Resultado: navegar até esse campo só de
teclado não mostrava **nenhum** indicador visual de foco, violando
diretamente "foco visível em todo elemento interativo" (docs seção 12) -
apesar de o projeto já ter uma regra `:focus-visible` global em
`src/styles/index.css` desde a fase 1a, essa regra de componente a
sobrescrevia silenciosamente. Corrigido removendo o `outline-none`: o
campo volta a usar o anel global padrão, sem precisar de nenhum CSS
dedicado.

**O resto da auditoria de acessibilidade já estava coberto desde a fase
1a, confirmado nesta revisão em vez de refeito**: `:focus-visible`
universal e `prefers-reduced-motion` (zera toda `animation`/`transition`
do site, `*`, em `src/styles/index.css`) já cobrem automaticamente
qualquer componente novo das fases 2-4 sem precisar de CSS por
componente - só a exceção pontual acima (um `outline-none` sem
substituto) escapou disso. `aria-live` já vinha dos elementos `<output>`
(papel implícito `status`) usados em `SyncIndicator`/`UndoToast`/
`UpdateBanner`, e dos anúncios de fase do dnd-kit (fase 1c). Nenhuma
mudança nova foi necessária nessas frentes - só a auditoria confirmou que
seguiam valendo depois de três fases de componentes novos em cima.

### Bug real em produção: cabeçalho estourava a largura nos celulares comuns, e isso "vazava" pra página inteira

**Relatado pelo usuário com duas fotos do celular**: o ícone do canto
superior direito do cabeçalho não aparecia, e ao abrir o detalhe de uma
tarefa "o zoom da página fica diferente, cortando um pedaço da página à
direita". O próprio usuário suspeitou, corretamente, que os dois eram "o
mesmo problema".

**Causa raiz confirmada com um iframe de largura real (393/360/320px)
embutido numa aba do Chrome** - `resize_window` não redimensiona de
verdade neste ambiente, então a única forma confiável de testar uma
largura de celular real foi um `<iframe>` com `style.width` fixo apontando
pro servidor de dev, inspecionado com `javascript_tool`/`computer:zoom`:
`AppHeaderActions.tsx` (indicador de sync + histórico + configurações +
tema) não tinha `flex-wrap` nem conseguia encolher (`shrink-0`) - nos
celulares mais comuns (320-412px), os quatro itens juntos simplesmente não
cabem numa linha só (o `SyncIndicator` sozinho já passa de 240px só com
"Sincronização não configurada"; bem mais com o resumo depois de
confirmar). Sem quebrar linha nem encolher, o último botão
(`ThemeToggle`) ficava **fisicamente fora do viewport** - não escondido,
inexistente na tela, sem aviso nenhum.

**O efeito colateral inesperado, que explica o segundo sintoma:** esse
único elemento estourando a largura (mesmo escondido atrás do overlay do
diálogo de detalhe, mesmo `aria-hidden`) alargava o `scrollWidth` da
página inteira além do `clientWidth` do dispositivo. Confirmado: no
reproduzido via iframe, `document.documentElement.scrollWidth` ficava
maior que `clientWidth` mesmo com o painel de detalhe fechado, e o próprio
painel de detalhe (que sozinho não tinha overflow nenhum - `w-[min(26rem,
100vw)]` funciona certinho isolado) herdava esse viewport já alargado -
exatamente o "zoom errado, cortando a página à direita" que a foto
mostrava. Não existia nenhuma rede de segurança (`overflow-x: hidden`) em
`html`/`body` contendo esse tipo de vazamento.

**Correção original, em duas partes:**
1. `AppHeaderActions.tsx`: `shrink-0` → `min-w-0` + `flex-wrap` +
   `justify-end`. `min-w-0` é o que importa de verdade - sem ele, mesmo
   com `flex-wrap`, a `div` (sozinha na própria linha depois do cabeçalho
   quebrar) continuava do tamanho do seu conteúdo em vez de encolher até a
   largura real disponível; sem a CAIXA encolher, o `flex-wrap` de dentro
   nunca tinha motivo pra quebrar os filhos. Nos celulares estreitos, os
   botões de ícone quebravam pra uma segunda linha (sempre visíveis, nunca
   cortados) em vez de telas largas, onde tudo continuava numa linha só.
2. `src/styles/index.css`: `overflow-x: hidden` em `html` e `body` - não
   concerta um estouro em si, é a rede de segurança para que UM elemento
   que passe da largura (mesmo um futuro, mesmo atrás de um diálogo) nunca
   mais alargue o viewport de layout inteiro de novo. **Essa parte ficou,
   não foi revertida** - continua valendo mesmo depois do ajuste abaixo.

**Revisão pedida pelo usuário, feedback depois de ver a correção no ar:**
achou a quebra de linha feia e preferiu **menos informação na barra a uma
barra de duas linhas** - "diminuir a informação da sincronização" em vez
de quebrar. `flex-wrap`/`justify-end`/`min-w-0` saíram de
`AppHeaderActions.tsx` (voltou a ser só `flex items-center gap-1.5`); quem
resolve o estouro agora é `SyncIndicator.tsx`: o rótulo que aparece na
barra (`label`) ficou bem mais curto - "Sincronizado às 20:46" em vez de
"Sincronizado às 20:46 — 3 enviadas, 2 recebidas de outro aparelho.
Confirmado." - e o `max-w` do texto caiu de `max-w-56` (224px) pra
`max-w-28` (112px) nos celulares. **A informação não sumiu**: o texto
completo continua no `title` (`detail`, uma variável separada de `label`)
- aparece ao segurar o dedo ou passar o mouse, do jeito que já funcionava
antes pra qualquer texto truncado no app. Verificado que mesmo o pior caso
(a mensagem de erro mais longa, "Resposta inesperada (provável bloqueio
da rede ou página de login do Google).") cabe numa linha só até 320px.

**Teste de regressão** em `e2e/responsive.spec.ts` (viewport 320px, o
menor que o app testa): confirma os quatro botões do cabeçalho visíveis E
**na mesma linha** (compara a coordenada `y` de cada um - uma quebra real
os separaria por ~36px, bem acima da tolerância de 10px do teste) e
`scrollWidth <= clientWidth` tanto na tela principal quanto com o painel
de detalhe aberto. Confirmado, nas duas rodadas (a correção original com
`flex-wrap` e esta revisão sem ele), que o teste falha sem a correção
correspondente e passa com ela.

### Bug real em produção: texto do painel de detalhe se perdia sem o `onBlur` disparar

**Relatado pelo usuário**: "às vezes estou no meio de uma tarefa e acabo
perdendo [o que digitei], ou a tela dando atualização." Investigado junto
com o estouro do cabeçalho (acima) por serem relatados na mesma mensagem,
mas a causa raiz aqui é diferente e específica do painel de detalhe.

**Causa raiz:** `TaskDetailFields.tsx` salvava os campos de texto (título,
notas, delegação, tags) **só no `onBlur`** - decisão deliberada desta fase
("editar um campo e sair dele é um evento discreto o bastante pra não
precisar de temporizador"). Essa premissa supõe que a pessoa sempre sai do
campo de propósito. Na prática, qualquer interrupção fora do controle dela
- trocar de app no celular e o navegador reclamar a aba em segundo plano,
a aba perder o processo por pressão de memória, fechar sem querer - encerra
a edição **sem nunca disparar o `onBlur`**. Tudo que tinha sido digitado e
ainda não "solto" do campo (com o cursor ainda lá dentro) se perdia por
inteiro, porque nada mais no app persistia esse texto em lugar nenhum.
"A tela dando atualização" bate com isso: reabrir o app depois de uma
dessas interrupções mostra um estado que parece ter "voltado" para antes
da edição.

**Correção:** `src/ui/hooks/useDebouncedCallback.ts` (novo, reutilizável) -
cada campo de texto em `TaskDetailFields.tsx` ganhou um autosave que
dispara sozinho depois de uma pausa de digitação de 1.5s
(`AUTOSAVE_DELAY_MS`), **sem precisar sair do campo**. O `onBlur` continua
existindo do jeito que já era (salvamento imediato e garantido ao sair) -
o autosave é só a rede de segurança pro meio do caminho, pro que a pessoa
digitou sobreviver mesmo que a interrupção aconteça enquanto o cursor
ainda está no campo.

Cuidado ao implementar o hook: a primeira versão guardava a `callback`
mais atual escrevendo direto num `useRef` **durante a renderização**
(`callbackRef.current = callback`) - o oxlint (`react(refs)`) rejeitou
isso com razão: mutar um ref durante o render quebra a pureza esperada
pelo React. Corrigido movendo essa escrita para dentro de um `useEffect`
(o padrão correto do "ref sempre atual"), e envolvendo `run`/`cancel` em
`useCallback` - sem isso, o `useEffect` de limpeza (`useEffect(() =>
cancel, [])`) também disparava o aviso de dependências do oxlint por
`cancel` ser uma função nova a cada render.

**Teste de regressão** em `e2e/task-detail-autosave.spec.ts`: digita no
campo "Notas", espera passar da pausa do autosave **sem nunca clicar fora
do campo** (o `onBlur` literalmente nunca dispara no teste), recarrega a
página (simula a interrupção de verdade) e confirma que o texto
sobreviveu. Confirmado que esse teste **falha** (valor vazio) sem a
correção e passa com ela.

**Verificado também na mão**, digitando dentro do `<textarea>` e lendo o
IndexedDB direto via `indexedDB.open('matriz-eisenhower')` sem nunca sair
do campo - o valor já estava persistido no banco antes mesmo do teste
automatizado existir, e o campo nem perdeu o foco/posição do cursor ao
salvar (o autosave é silencioso - escreve no Dexie, não mexe no estado
local `useState` que já está exibindo o que a pessoa digitou).

## Segurança (o repositório é público)

- **Nenhum segredo no código, nos testes ou no histórico do git.**
- URL e token do Apps Script são digitados no aparelho e vivem só no
  `localStorage`. Nunca no repositório, nunca na URL de uma requisição, nunca
  em log ou mensagem de erro — redija explicitamente ao tratar erro.
- Testes usam URLs e tokens falsos (`https://script.google.com/macros/s/teste-e2e/exec`
  no Playwright — hostname real do Apps Script, caminho inventado, nunca
  contactado de verdade porque `page.route()` intercepta antes da rede).
- O CI não tem segredo além do `GITHUB_TOKEN` padrão do Pages.
- `apps-script/README.md` tem o aviso de que **reimplantar** (não criar uma
  implantação nova) é o único jeito de manter a mesma URL depois de editar
  `Code.gs`.

## Publicação

GitHub Pages em `https://danielsilvaleles.github.io/matriz-eisenhower/`.
O `base` do Vite é `/matriz-eisenhower/` (`BASE_PATH` em `vite.config.ts`) e o
manifest, o `start_url`, o `scope` e o service worker da fase 4 seguem o mesmo
valor. `.github/workflows/deploy.yml` roda lint, tipos, testes e build e publica
a cada push na `main` (e, desde a extensão "Anotações", também na `master` -
ver abaixo).

O rodapé mostra o SHA do commit e a hora do build, para conferir de relance se
o Pages realmente publicou a versão nova.

### Build para dois repositórios (produção + beta), sem conflito de dados

**Por quê:** testar a extensão "Anotações" no celular/PC da empresa antes
de publicar em produção, sem usar o repositório real. O problema: o
navegador isola armazenamento (localStorage, IndexedDB, Cache Storage)
por **origem**, não por caminho - `danielsilvaleles.github.io/matriz-eisenhower/`
e `danielsilvaleles.github.io/matriz-eisenhower-beta/` são a MESMA origem
(`https://danielsilvaleles.github.io`). Sem isolar explicitamente, abrir o
beta leria e **migraria o banco real de produção**.

**Como funciona:** `.github/workflows/deploy.yml` calcula, a partir de
`github.event.repository.name`, dois valores passados como env vars pro
`npm run build`/`npx playwright test`:
- `VITE_BASE_PATH` = `/<nome-do-repo>/` (sempre).
- `VITE_APP_ID` = vazio (`''`) se o repo for `matriz-eisenhower`
  (produção); senão, o próprio nome do repo (ex.: `matriz-eisenhower-beta`).

`src/appId.ts` é a convenção central: **`APP_ID === ''` significa
produção**, e toda função ali (`dbNameFor`, `storageKeyFor`, `cacheIdFor`,
`appNameFor`) devolve o nome de sempre, sem nenhum prefixo, para esse
caso - zero mudança de comportamento hoje. Qualquer outro id prefixa:

- `src/db/schema.ts` (`DB_NAME`): `"<appId>-matriz-eisenhower"`.
- `src/ui/theme.ts`, `src/db/device.ts`, `src/sync/config.ts`: cada chave
  de `localStorage` ganha `"<appId>:"` na frente.
- `vite.config.ts`: `workbox.cacheId` (só passado quando há app id - em
  produção a opção nem existe no config) prefixa todo nome de cache do
  Workbox via `setCacheNameDetails`; manifest `name`/`short_name`
  passam a "Matriz (beta)"/"Matriz beta"; `id`/`start_url`/`scope` seguem
  o `BASE_PATH` calculado (já seguiam antes, automaticamente).
- `HeaderBar.tsx`: selo "BETA" ao lado do título quando `IS_BETA`.

**Achado ao implementar:** `index.html` tinha dois `href` hardcoded
(`favicon.svg`, `apple-touch-icon.png`) com `/matriz-eisenhower/` literal -
só os assets que o Vite injeta (CSS, manifest) seguem o `base` do build
automaticamente; um `href` escrito à mão no HTML-fonte, não. Confirmado
compilando com um `base` diferente antes de mexer em qualquer config real
(o ícone continuava apontando pro caminho de produção). Corrigido com
`%BASE_URL%` (substituição nativa do Vite em HTML, sempre definida). A
chave de tema do script de pré-pintura (antes do React, único trecho que
`src/ui/theme.ts` documenta como "duplicado de propósito") ficou **sem**
prefixo, de propósito - prefixá-la ali dependeria de uma variável de
ambiente que pode nem existir nesse contexto; o efeito é só cosmético (tema
errado por um instante no beta, nunca lê/escreve o valor de produção).

`vite.config.ts`/`playwright.config.ts`/`e2e/fixtures.ts`/`e2e/pwa.spec.ts`
leem `process.env.VITE_BASE_PATH`/`VITE_APP_ID` **direto**, nunca
importam `src/appId.ts` - esses arquivos rodam em Node puro (configuração/
CLI/Playwright), fora do transform do Vite que torna `import.meta.env`
válido. Mesma duplicação que já existe entre `src/domain/checksum.ts` e
`apps-script/Code.gs`, pelo mesmo motivo (contextos de execução
diferentes). `tsconfig.node.json` ganhou `"vite/client"` nos `types` (o
Vitest roda sobre o Vite de verdade, então `import.meta.env` é válido em
teste - sem isso `src/appId.test.ts` não tipava).

**`Code.gs` continua sendo uma implantação própria, não acompanha o
`VITE_APP_ID` automaticamente** - `FOLDER_NAME`/`DATA_FILE_NAME` vêm de
`PropertiesService`, com os literais de produção (`"Matriz de
Eisenhower"`, `"matriz.json"`) como padrão. Uma cópia do script para
testar o beta roda `setupBetaStorage()` (menu Executar, grava duas
propriedades) e **reimplanta** (os nomes só são lidos no início de cada
execução) - sem isso, a cópia beta sincronizaria com os dados REAIS de
produção, mesmo com o front isolando localStorage/IndexedDB/cache do
navegador. Passo a passo completo em `apps-script/README.md`.

Testes: `src/appId.test.ts` (produção reproduz os literais de hoje; dois
app ids nunca compartilham banco/chave de localStorage/cacheId) e um
cenário em `apps-script/test/harness.mjs` que roda `setupBetaStorage` +
simula uma reimplantação, confirmando que a cópia beta grava num Drive
totalmente separado do de produção. Confirmado manualmente também: um
build com `VITE_BASE_PATH`/`VITE_APP_ID` diferentes gera
`sw.js`/manifest/ícones corretos para esse caminho, e os mesmos testes
Playwright passam contra ele.

## Limitações aceitas (registradas de propósito)

- **Relógio dos aparelhos pode divergir.** A mesclagem usa "vence o `updatedAt`
  mais recente", então um relógio muito errado pode fazer uma edição antiga
  ganhar. Aceitável para um único usuário; o desempate por nome do aparelho
  garante ao menos que o resultado é determinístico.
- **Sem tempo real.** Uma captura no celular chega ao PC no próximo gatilho
  automático (abrir o app, focar a aba, reconectar, ou até 1 hora depois
  pelo relógio periódico) ou ao clicar em "Sincronizar agora"/atalho `S` —
  esse é o jeito confiável de não esperar.
- **O push envia o documento inteiro**, não um delta. Simples e suficiente nesta
  escala; se o arquivo crescer muito, reavaliar.
- **Bundle de produção em ~668 KB (205 KB gzip)**, acima do aviso padrão de
  500 KB do Vite. Vem de dnd-kit + radix-ui + Dexie + React, tudo carregado de
  uma vez (sem `import()` dinâmico). Aceitável: desde a fase 4 é mesmo um PWA
  que faz cache do app inteiro no primeiro acesso (service worker,
  `vite.config.ts`) — carrega uma vez, funciona offline depois, o tamanho do
  bundle deixa de ser o problema recorrente que seria sem cache. Reavaliar
  com `code-splitting` só se o carregamento inicial (antes do cache existir)
  virar queixa real.
- **O service worker só avisa de uma versão nova na próxima vez que o app é
  aberto/focado** (docs 6.1-style polling, não um push) — se a aba ficar
  aberta em segundo plano por muito tempo sem perder e recuperar o foco, o
  aviso "Nova versão disponível" pode demorar a aparecer. Aceitável para um
  app de um usuário só.
- **Arrastar para reordenar dentro de Q2 não "gruda"**: Q2 sempre reordena a
  exibição por data (docs 5.4), então soltar numa posição manual específica
  é imediatamente sobrescrito no próximo render. Decisão deliberada, não bug
  — ver "sortTasksForQuadrant" no CLAUDE.md.

## Estado atual

Fase 2 concluída: backend em Apps Script (`apps-script/Code.gs` — ping/pull/push,
token com comparação de tempo fixo, `LockService` em volta do push com
conferência de `baseRevision` dentro do lock, rotação de backup `bak1`/`bak2`,
proteção contra encolhimento drástico sem `allowShrink`) com README de
publicação/reimplantação e harness de teste próprio (16 cenários, sem
publicar nada de verdade); mesclagem pura com os 6 cenários exigidos +
limpeza de tombstone de 30 dias; motor de sync com o ciclo
pull → mesclar → push → **releitura e verificação de checksum** antes de
confirmar, até 3 tentativas em conflito; gatilhos automáticos (abrir, foco,
60s visível, 3s após editar, voltar a conexão) e manual (botão/atalho `S`);
indicador sempre visível com os 5 estados e contador de pendências; tela de
Configurações com URL/token (só em `localStorage`) e "Testar conexão";
aviso ao fechar a aba com pendências; 3 testes Playwright do fluxo de sync
contra um servidor simulado por interceptação de rota, no CI.

Nenhum bug real encontrado na fase 2 pelo teste automatizado ou manual —
diferente da 1c (que teve 2). A única correção foi no próprio teste: um
checksum reimplementado no servidor falso do Playwright que divergia do
real num detalhe (ver "Lição de fidelidade de teste-duplo" acima), corrigido
reusando `computeChecksum` de verdade em vez de reescrevê-lo.

Fase 3 concluída: modo triagem (docs seção 5.3 — item grande, mini matriz
2x2, teclas `1`-`4`/`E`/`S`/`Esc`, "Me ajude a decidir", chips de data após
Agendar, "Para quem?" com autocomplete após Delegar, barra de progresso,
tela de caixa zerada); data contextual por quadrante (docs 5.4 — "Prazo" em
Q1, "Agendada para" + selos "Hoje"/"Atrasada" + ordenação por data + "sem
data" em âmbar + "Bloquear na agenda" em Q2, "Cobrar em" + "Para quem" +
estados "a delegar"/"aguardando Fulano" + "Copiar mensagem de delegação" +
selo "Cobrar hoje" em Q3, esmaecimento + arquivamento automático na virada
do dia + "n eliminadas esta semana" em Q4); faixa "Hoje" clicável (docs
5.1); painel de detalhe com autosave e linha do tempo (docs 5.5); histórico
pesquisável com restaurar (docs 5.9); atalhos `Enter` e `T` completados
(docs 5.6); 3 testes Playwright do fluxo de triagem no CI.

Dois bugs reais encontrados e corrigidos nesta fase (detalhados acima): o
botão "Mover" ficava permanentemente invisível no painel de detalhe e no
histórico (achado no teste manual), e o último item da triagem podia pular
o passo de data/delegação por uma corrida entre o esvaziamento da caixa e
uma releitura assíncrona do Dexie (achado pelo Playwright, não pelo teste
manual — o padrão clássico desta fase inteira: bugs de timing/corrida
aparecem no automatizado, bugs puramente visuais aparecem na mão).

Fase 4 concluída: instalável, com manifest (`id`/`name`/`start_url`/`scope`
no subcaminho certo, ícones 192/512/maskable) e `registerType: 'prompt'`
(nunca recarrega sozinho - banner "Nova versão disponível" com botão
"Atualizar"); atalho de app "Nova anotação" (`?captura=1`, foca a captura);
share target por GET (título+texto+URL viram uma tarefa só na caixa de
entrada, com a origem "Compartilhado"); indicador "Offline" na hora, sem
esperar uma tentativa de sync; captura e navegação continuam funcionando
com o servidor totalmente fora do ar (confirmado na mão e por
`context.setOffline(true)` do Playwright); 5 testes Playwright de PWA no CI.

Um bug real encontrado nesta fase (detalhado acima): compartilhar um link
com título, texto e URL virava **três** tarefas na caixa de entrada em vez
de uma, porque o texto combinado usava quebra de linha e `captureItem`
trata cada linha como um item separado - achado testando na mão
(claude-in-chrome), não pelos testes automatizados (que validavam o
conteúdo combinado, mas não pensavam em como ele seria consumido depois).

Fase 5 concluída (última do plano original - `docs/prompt-matriz-eisenhower.md`
seção 11): revisão semanal (docs 5.9 - distribuição de concluídas por
quadrante, quantas chegaram em Q1 vindas de Q2 atrasado, tempo médio parado
na caixa de entrada, quantas eliminadas), numa aba nova dentro do próprio
histórico; auditoria de acessibilidade confirmando que `:focus-visible`
universal e `prefers-reduced-motion` (ambos desde a fase 1a) já cobriam os
componentes das fases 2-4 sem precisar de nada novo.

Três bugs reais de acessibilidade encontrados nesta fase, nenhum por
inspeção visual - dois por calcular a razão de contraste de verdade (não só
"parece legível"), um por navegar de teclado até o fim (detalhado acima):
`--color-focus`/`--color-q4` usados como fundo sólido com texto branco
davam só 2.2:1 e 3.2:1 no tema escuro (bem abaixo do 4.5:1 de AA) porque
nunca tinham sido calibrados para esse papel - só para anel de foco e
gráfico/ícone, que são exigências diferentes (3:1, não 4.5:1); corrigido
com dois tokens novos (`--color-accent`/`-ink`, `--color-danger`/`-ink`)
cobertos no `tokens.contrast.test.ts`. E o campo "Adicionar tarefa" de
cada quadrante tinha `focus:outline-none` sem nenhum substituto - o único
elemento interativo do app sem indicador de foco visível algum, apesar da
regra global `:focus-visible` existir desde a fase 1a (a classe do próprio
componente a sobrescrevia).

Esta é a última fase do plano original do documento. O app cobre as
cinco fases (`docs/prompt-matriz-eisenhower.md`, seção 11): núcleo local,
sincronização, triagem, PWA, e agora revisão e refinamento.

### Pós-lançamento: uso real diário, seis correções

Depois da fase 5 no ar, o app entrou em uso real diário (o usuário é tech
manager, dia tomado por reuniões, captura muitas vezes só com o celular na
mão — exatamente o perfil que o documento original descreve). Seis bugs
reais chegaram por relato direto do usuário nessa janela, nenhum achado
pelos testes das cinco fases — a suíte cobria os fluxos das docs, não as
condições de corrida e de layout real que só uso contínuo expõe. Todos
detalhados em "Decisões de arquitetura" acima; resumo aqui pra quem quer
o retrato geral sem ler cada seção:

1. **Tarefa perdida durante um ciclo de sync** — `applyMergedState` usava
   `clear()+bulkAdd()` a partir de um snapshot do início do ciclo; uma
   tarefa criada durante o ciclo (pull→push→verificação, tempo real de
   rede) era apagada ao final. Corrigido com `bulkPut`. Pedido junto:
   intervalo do timer periódico de 60s → 1h.
2. **Movimentação desfeita ao mover uma tarefa já existente durante o
   sync** — variante mais sutil do bug acima, que o `bulkPut` sozinho não
   cobria (o id já estava em `merged`, só que com o quadrante antigo).
   Corrigido relendo o estado local de novo bem antes de gravar e
   mesclando com o resultado do ciclo (`applyAndConfirm`).
3. **Clicar no título da tarefa concluía por engano** — `TaskRow` usava um
   único `<label>` pro checkbox e pro título; pedido do usuário para
   separar as duas ações (título abre detalhe, só o checkbox conclui).
4. **Segundo item da triagem "não fazia nada"** — uma corrida entre o
   clique/tecla e a movimentação assíncrona no Dexie deixava uma janela
   onde um segundo clique disparava uma segunda movimentação concorrente,
   cuja resolução tardia sobrescrevia o passo que a primeira tinha aberto.
   Corrigido com uma trava (`busy`) em todos os pontos de entrada da
   triagem.
5. **Cabeçalho estourava a largura nos celulares comuns**, e isso vazava
   pra página inteira (o painel de detalhe abria "cortado" mesmo sem
   nenhum problema nele mesmo) — corrigido em duas rodadas: primeiro com
   `flex-wrap` (funcionava, mas o usuário achou a quebra de linha feia),
   depois revisado pra um rótulo de sincronização bem mais curto, voltando
   a caber tudo numa linha só. `overflow-x: hidden` em `html`/`body` ficou
   como rede de segurança permanente contra esse tipo de vazamento.
6. **Texto do painel de detalhe se perdia sem o `onBlur` disparar** — os
   campos só salvavam ao sair do campo, premissa que não sobrevive a uma
   interrupção fora do controle da pessoa (app em segundo plano reclamado
   pelo sistema, por exemplo). Corrigido com autosave debounced
   (`useDebouncedCallback`, 1.5s de pausa), mantendo o `onBlur` como
   salvamento imediato de qualquer jeito.

**Padrão que se repete nos bugs 1, 2 e 4**: todos são uma escrita local
concorrente com uma operação assíncrona mais longa (um ciclo de sync, uma
movimentação de triagem) que lê um snapshot no início e grava de volta no
fim - sem reler o estado logo antes de escrever, qualquer coisa que
aconteça no meio do caminho é perdida ou desfeita silenciosamente, sem
erro nenhum. Vale a pena desconfiar desse padrão em qualquer código novo
que leia-processa-grava com uma espera real no meio.

### Extensão "Anotações + menu inferior" (`docs/prompt-anotacoes.md`)

Trabalho feito na branch `feature/anotacoes` (nunca mesclada/publicada por
este agente - ver `docs/RELATORIO-ANOTACOES.md` para o relatório completo
e o roteiro de teste manual). Três fases da seção 10 do prompt, mais o
item 8 (build para dois repositórios):

**Fase 1 (núcleo local + menu inferior):** tabela `notes` nova + migration
testada com fixture v1; roteamento por hash próprio (`#/anotacoes`,
`#/anotacoes/:id`); editor com autosave agressivo (debounce 500ms +
flush em blur/visibilitychange/pagehide, "Inserir hora", continuação de
lista no Enter); lista com busca/filtro/agrupamento por dia; menu
inferior do celular (4 destinos) substituindo a barra de captura fixa;
abas e atalhos (`A`/`L`/`/`) no desktop; lixeira de 30 dias.

**Fase 2 (sincronização):** `notes` no protocolo de sync (checksum,
payload, validação); ação `status` (pula o pull completo quando nada
mudou); mesclagem com cópia de conflito para edição concorrente de
anotação (nunca descarta texto - `src/domain/noteMerge.ts`); **compatibilidade
obrigatória com o script antigo** (`capabilities` ausente = script
anterior a esta extensão - tarefas continuam sincronizando, anotações
ficam só locais até reimplantar, nunca falha nem perde dado); aviso prévio
de payload perto do limite.

**Fase 3 (elo com a matriz + exportação):** linhas `[ ]`/`- [ ] ` de uma
anotação ganham botão "→ Caixa de entrada" (cria tarefa com
`source_note_id`, marca `[→]`); "Ver anotação de origem" no detalhe da
tarefa; backup passa a incluir anotações (tolerante a um backup sem a
chave `notes`); "Exportar anotações em Markdown".

**Item 8 (build para dois repositórios):** ver "Build para dois
repositórios" na seção Publicação, acima.

**Dois bugs reais encontrados, nenhum por teste que já existia antes
desta extensão:**

1. **`isValidData_` (Code.gs) rejeitava um `matriz.json` existente sem a
   chave `notes`** - a primeira leitura depois de reimplantar o script
   cairia para `emptyData_()`, fazendo tarefas de verdade "desaparecerem"
   da tela (não do Drive). Achado revisando o código pensando no caminho
   INVERSO da compatibilidade pedida (dados antigos relidos por um script
   novo). Corrigido tolerando a ausência da chave e normalizando para
   `[]` logo depois de validar (`normalizeData_`).
2. **`index.html` tinha dois `href` hardcoded** (`favicon.svg`,
   `apple-touch-icon.png`) com `/matriz-eisenhower/` literal - só os
   assets que o Vite injeta (CSS, manifest) seguiam o `base` do build
   automaticamente. Achado compilando com um `base` diferente antes de
   mexer em qualquer config real. Corrigido com `%BASE_URL%`.

Gate completo (lint, typecheck, 423 testes unitários, 24 cenários do
harness do Apps Script, 28 testes Playwright) verde ao final de cada
fase, mais uma rodada extra validando um build com `VITE_BASE_PATH`/
`VITE_APP_ID` diferentes (simulando o repositório beta) contra os mesmos
testes Playwright.
