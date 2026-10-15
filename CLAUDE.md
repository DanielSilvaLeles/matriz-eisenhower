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
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em `http://localhost:4173/matriz-eisenhower/` |
| `npx playwright test` | 3 fluxos essenciais ponta a ponta — precisa de `npm run build` antes (roda contra o build de produção via `npm run preview`) |
| `npm run check` | Lint + tipos + testes + build. É o que o CI roda (o Playwright roda como passo à parte no CI, depois do build). |

## Arquitetura

**Decisão fechada (não reabrir):** a rede da empresa bloqueia a VPS pessoal e
libera apenas GitHub Pages e Google Apps Script. Por isso o front é 100%
estático, o banco local é a fonte da verdade imediata e o Drive (via Apps
Script) é a cópia compartilhada entre aparelhos. Nada de VPS, túnel ou proxy.

```
src/
  domain/   regras puras, sem React, sem banco, sem rede — tudo com teste
  db/       Dexie: schema, migrations, repositório de tarefas e backup
  capture.ts  porta única de captura (docs seção 8), usada pela caixa de entrada
  sync/     ciclo pull -> merge -> push -> verificação      (fase 2)
  ui/
    components/  componentes de apresentação
    dnd/         DndContext único (desktop + caixa de entrada), ids de contentor
    actions/     orquestração (ex.: mover tarefa + registrar desfazer)
    shortcuts/   atalhos de teclado globais
    undo/        store do toast "Desfazer" (um nível, 6s)
    help/        store do painel de ajuda (atalho `?`)
    hooks/       hooks genéricos (useMediaQuery, useNowTick, useTheme)
  lib/      utilitários genéricos
  styles/   tokens de design e CSS global
e2e/        Playwright — 3 fluxos essenciais (docs seção 9)
apps-script/  backend no Google Apps Script                 (fase 2)
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
`0`, `Ctrl+Z` e `?` (docs seção 5.6). **De propósito, não implementa** `Enter`
("abrir o detalhe"), `T` ("abrir a triagem") nem `S` ("sincronizar agora"):
os três têm para onde ir só nas fases 2 e 3 (painel de detalhe, modo
triagem, cliente de sync). Amarrar uma tecla a uma funcionalidade que ainda
não existe seria pior do que não ter o atalho — o painel de ajuda (`?`) só
lista os que funcionam de verdade agora; atualize a lista junto quando cada
funcionalidade chegar.

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

## Segurança (o repositório é público)

- **Nenhum segredo no código, nos testes ou no histórico do git.**
- URL e token do Apps Script são digitados no aparelho e vivem só no
  `localStorage`. Nunca no repositório, nunca na URL de uma requisição, nunca
  em log ou mensagem de erro — redija explicitamente ao tratar erro.
- Testes usam `https://example.invalid/exec` e tokens falsos.
- O CI não tem segredo além do `GITHUB_TOKEN` padrão do Pages.

## Publicação

GitHub Pages em `https://danielsilvaleles.github.io/matriz-eisenhower/`.
O `base` do Vite é `/matriz-eisenhower/` (`BASE_PATH` em `vite.config.ts`) e o
manifest, o `start_url`, o `scope` e o service worker da fase 4 seguem o mesmo
valor. `.github/workflows/deploy.yml` roda lint, tipos, testes e build e publica
a cada push na `main`.

O rodapé mostra o SHA do commit e a hora do build, para conferir de relance se
o Pages realmente publicou a versão nova.

## Limitações aceitas (registradas de propósito)

- **Relógio dos aparelhos pode divergir.** A mesclagem usa "vence o `updatedAt`
  mais recente", então um relógio muito errado pode fazer uma edição antiga
  ganhar. Aceitável para um único usuário; o desempate por nome do aparelho
  garante ao menos que o resultado é determinístico.
- **Sem tempo real.** Uma captura no celular chega ao PC no próximo ciclo (até
  cerca de 1 minuto) ou ao clicar em "Sincronizar agora".
- **O push envia o documento inteiro**, não um delta. Simples e suficiente nesta
  escala; se o arquivo crescer muito, reavaliar.
- **Bundle de produção em ~610 KB (191 KB gzip)**, acima do aviso padrão de
  500 KB do Vite. Vem de dnd-kit + radix-ui + Dexie + React, tudo carregado de
  uma vez (sem `import()` dinâmico). Aceitável por ora: é um PWA que faz cache
  do app inteiro no primeiro acesso (fase 4) — carrega uma vez, funciona
  offline depois. Reavaliar com `code-splitting` se a fase 4 mostrar isso como
  problema real de carregamento inicial.

## Estado atual

Fase 1c concluída: arrastar e soltar (entre quadrantes, reordenar dentro do
quadrante, da caixa de entrada para um quadrante), atalhos de teclado
(`N`, setas, `1`-`4`, `0`, `Ctrl+Z`, `?`), caixa de entrada completa (captura
com `#tag`, colagem multilinha, origem e tempo parado, destaque após 24h),
desfazer com toast de 6s, menu "Mover para" (Radix `DropdownMenu`), layout
mobile dedicado (mini matriz seletora, folha de caixa de entrada, barra de
captura fixa, alvos de 48px), exportar/importar backup com pré-visualização,
3 testes Playwright do fluxo "adicionar e mover tarefa" no CI.

Dois bugs reais de verdade encontrados e corrigidos nesta fase (detalhados
acima): a zona soltável de um quadrante vazio media só 32px, e duas árvores
de layout montadas ao mesmo tempo quebravam o arrastar para "Fazer"
especificamente. Nenhum dos dois apareceu nos testes unitários/integração —
só o teste manual no navegador (o primeiro) e o Playwright (o segundo)
pegaram. Também corrigido: o typecheck não checava nenhum arquivo desde a
fase 1a (`tsc --noEmit` contra um `tsconfig.json` de só-referências não
segue as referências — precisa de `tsc --build`).

Ainda não tem: Enter abre detalhe, T abre triagem, S sincroniza (todos sem
destino até as fases 2 e 3), modo triagem, delegação com pessoas, histórico,
PWA (manifest, service worker, share target), sincronização de verdade.
Fases em `docs/prompt-matriz-eisenhower.md`, seção 11.
