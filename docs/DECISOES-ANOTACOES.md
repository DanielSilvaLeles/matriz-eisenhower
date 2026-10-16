# Decisões — Anotações + menu inferior

Registro de toda decisão tomada sob a regra da seção 1.2 do prompt: "se
algo deste prompt conflitar com o que já existe, escolha a opção mais
segura e registre a diferença e o motivo aqui."

## 1. Um arquivo só no Drive, não `matriz.json` + `notas.json`

**Prompt pede (seção 6.3):** "Avalie e me proponha separar os dados em
arquivos por coleção... Se achar que não compensa para o volume esperado
(centenas de anotações por ano), justifique e mantenha um arquivo só."

**Decisão:** um arquivo só. Separar dobraria toda a superfície do
protocolo de sync (duas revisões, duas travas `LockService`, duas rotações
de backup, dois checksums, dois fluxos de conflito) por um ganho pequeno
nessa escala — o payload inteiro de uma pessoa só com centenas de
anotações de texto simples ainda fica bem abaixo do limite de payload do
Apps Script (2 MB). A ação `status` nova (revision+checksum sem dados)
resolve a maior parte do problema real de desempenho: evita puxar o
arquivo inteiro quando nada mudou, que é o caso mais comum em qualquer
ciclo de sync automático.

## 2. Tags de anotação não removem o `#texto` do corpo

**Prompt pede (seção 5):** "Tags com #nome no texto, extraídas
automaticamente (mesma lógica das tags da caixa de entrada)."

**Decisão:** reusa a mesma expressão regular de `src/domain/capture.ts`
para RECONHECER tags, mas não apaga o `#tag` do texto da anotação — só
acrescenta ao array `tags`. Na caixa de entrada, o título é uma linha
curta e descartável; o corpo da anotação é o registro literal de uma
reunião, e apagar o que foi digitado ali (mesmo que seja só "#fulano")
desfiguraria o texto que a pessoa quer reler depois. "Mesma lógica" foi
lido como "mesmo reconhecimento de padrão", não "mesmo efeito colateral de
limpar o texto".

## 3. Sem biblioteca de virtualização

**Prompt pede (seção 4):** "Lista longa precisa continuar rápida:
virtualização ou paginação se passar de umas 200 anotações."

**Decisão:** paginação simples ("Carregar mais", 50 de cada vez), não
`react-window`/`@tanstack/react-virtual`. O app evita dependência pesada
de propósito em toda parte (Radix cru em vez do CLI do shadcn, textarea
simples em vez de editor rico) — adicionar uma biblioteca de virtualização
só para a faixa "acima de 200" quebraria esse padrão por um volume que o
próprio documento descreve como "centenas por ano", não milhares.

## 4. Roteamento por hash sem biblioteca de rotas

**Prompt pede (seção 3.3):** roteamento por hash para link direto e reload
funcionarem no GitHub Pages.

**Decisão:** um store mínimo (`src/ui/router/store.ts`), mesmo padrão já
usado em `selectedTaskIdStore`/`triageOpenStore` (`useSyncExternalStore` +
`createStore`), ouvindo `window.hashchange`. Três rotas conhecidas
(`#/`, `#/anotacoes`, `#/anotacoes/:id`) não justificam `react-router` ou
qualquer outro roteador de propósito geral.

## 5. Schema version 2, migração testada com fixture do formato atual

O prompt exige teste de migração "com dados no formato atual (fixtures),
provando que tarefas, pessoas e histórico existentes sobrevivem intactos."
Registrado aqui porque é o tipo de coisa que, se divergir silenciosamente
do código real, perde dado de verdade — ver `src/db/migration.test.ts`
(fase 1) para o teste correspondente.

## 6. `schemaVersion` do protocolo de sync não subiu de novo na fase 2

**Prompt pede (seção 6.1):** "O `schemaVersion` do `matriz.json` sobe, com
migration do IndexedDB e do arquivo" - texto escrito pensando na fase 1
(tabela `notes` nova). A fase 2 acrescenta `notes` ao PAYLOAD de sync (que
antes só viajava local), e isso é, por si só, uma mudança de formato do
protocolo.

**Decisão:** manter `CURRENT_SCHEMA_VERSION = 2` (já usado pela fase 1 para
a tabela local), sem bater para 3. Raciocínio: nenhuma versão 2 chegou a
ser publicada/sincronizada de verdade antes deste commit (fases 1a-1c
nunca ligaram o sync com `notes` no ar) - não existe nenhum arquivo
`matriz.json` real gravado com `schemaVersion: 2` e SEM `notes` que
precisasse de uma migração formal para o formato novo. Versão 2 já
significa, desde a fase 1, "o formato que inclui anotações" - a fase 2 só
termina de cumprir essa promessa no protocolo de rede. Bater para 3 seria
uma migração sem propósito real (não há dado antigo de verdade para
migrar), e a guarda de "recusa sincronizar com schemaVersion maior"
(`src/sync/engine.ts`, já testada desde a fase 1) continua funcionando
exatamente igual se algum dia precisar.

## 7. `last_confirmed_at` novo em `Meta`, só para decidir conflito de anotação

A detecção de edição concorrente (seção 6.2) precisa saber "o servidor
mudou essa anotação DEPOIS da última vez que eu sincronizei?". Guardar um
**mapa por anotação** da última versão confirmada seria mais preciso, mas
a complexidade (nova tabela, ou campo por nota) não se paga: um único
timestamp global (`meta.last_confirmed_at`, ao lado de
`last_confirmed_revision`/`last_confirmed_checksum` que já existiam) já
garante a leitura certa na prática - um relógio de aparelho muito errado
já é uma limitação aceita do projeto (CLAUDE.md, "Relógio dos aparelhos
pode divergir"), e o pior caso de um timestamp global longe do ideal é, no
máximo, detectar (ou deixar de detectar) um conflito que byte a byte seria
genuíno de qualquer forma - nunca perde texto, porque a cópia de conflito
só existe para o cenário em que ela SERIA necessária; no cenário onde ela
não é gerada por engano de falta de granularidade, a regra padrão
"`updated_at` mais recente vence" (já usada para tarefas) ainda se aplica
sem perder nada, só sem o aviso extra de "revise, pode ter duas versões".

## 8. Elo com a matriz: sem "modo de leitura" nem seleção de texto, só botão por linha

**Prompt pede (seção 5.1):** "No modo de leitura da anotação, cada linha
assim mostra um botão '→ Caixa de entrada'. No modo de edição, selecionar
um trecho de texto oferece 'Enviar para caixa de entrada'."

**Decisão:** o editor desta extensão (fase 1) nunca teve um "modo de
leitura" separado do de edição - é sempre um `<textarea>`. Em vez de
construir uma segunda forma de exibir o corpo (texto renderizado, não
editável, com os marcadores de ação clicáveis) só para hospedar esse
botão, ele aparece numa lista própria ("Itens de ação") logo abaixo do
campo, sempre visível quando a anotação já foi gravada - detecta as
linhas `[ ]`/`- [ ] ` pendentes com a mesma função pura
(`extractActionLines`, `src/domain/actionLines.ts`) que o modo de leitura
teria usado. A alternativa de **selecionar um trecho de texto** e
oferecer "Enviar para caixa de entrada" para QUALQUER seleção (não só uma
linha já marcada) não foi implementada - exigiria detectar seleção de
texto no textarea e uma barra de ferramentas flutuante, bem mais
trabalho para um caminho secundário quando o caminho principal (marcar a
linha com `[ ]` e ter o botão aparecer) já cobre o critério de aceite
central da seção ("uma linha de ação vira tarefa, com link de volta").
Registrado aqui como simplificação deliberada, não como lacuna
escondida - se um "modo de leitura" chegar a existir por outro motivo no
futuro, o botão por linha pode migrar para lá sem mudar
`extractActionLines`/`markActionLineSent`, que já são puros e já têm
teste próprio.

Também notado: o botão "→ Caixa de entrada" só aparece depois que a
anotação já foi gravada no banco (debounce de 500ms já disparado) - uma
anotação sendo composta pela primeira vez (ainda sem id persistido) não
mostra a lista de itens de ação até o primeiro autosave confirmar.
Nenhum teste manual encontrou isso incômodo na prática (o debounce é
curto o bastante), mas fica registrado para quem notar o atraso.

## 9. Detecção de script antigo: ausência de `capabilities`, nunca um valor explícito `false`

**Prompt pede (seção 1.6, obrigatório):** "se o script não suportar a ação
`status` ou a coleção de anotações (detecte pelo `ping`, que deve passar a
informar a versão e as capacidades do script), o app continua
sincronizando as tarefas normalmente, mantém as anotações apenas locais e
mostra o aviso."

**Decisão:** `capabilities: { notes: true, status: true }` entra em TODA
resposta de sucesso (`ping`/`status`/`pull`/`push`) do `Code.gs` desta
extensão. Um script publicado ANTES desta extensão simplesmente não tem
esse campo no objeto que devolve - o front detecta pela ausência da
chave (`pulled.capabilities?.notes === true`), nunca por um valor
`{notes: false}` que um script antigo nunca teria motivo de mandar.
Reusa a resposta do `pull` do próprio ciclo normal para essa detecção (não
faz uma chamada de `ping` extra a cada ciclo) - mais simples e sem custo
de rede adicional, já que `pull` e `ping` devolvem exatamente o mesmo
envelope.

Três ajustes para a compatibilidade ser real, não só a detecção:

- **Checksum** (`src/domain/checksum.ts`, `computeChecksum(contents,
  includeNotes)`): com `includeNotes: false`, omite a chave `notes` por
  completo do JSON canônico (não manda `[]` - um valor presente, mesmo
  vazio, já mudaria o hash). O teste `checksum.test.ts` confirma que esse
  modo reproduz **bit a bit** o hash que o projeto já usava antes desta
  extensão (`LEGACY_FIXTURE_HASH` = o antigo `FIXTURE_HASH`), prova de que
  é exatamente o mesmo cálculo de sempre, não uma aproximação.
- **Push** (`src/sync/client.ts`, `legacyPush`): omite a chave `notes` do
  corpo HTTP de verdade - não só no cálculo do checksum. Sem isso um
  script antigo gravaria essa chave sem validar (ele não sabe que ela
  existe), e o checksum que ELE calcula (sem saber da chave) nunca bateria
  com o que o front esperava.
- **Pendência** (`src/sync/engineApply.ts`, parâmetro `notesSupported` em
  `applyAndConfirm`): mesmo que uma anotação pendente não tenha mudado
  entre o início do ciclo e a releitura final, ela NUNCA é removida de
  `pending_ids` enquanto o script for antigo - ela nunca foi enviada de
  verdade, e o contador de pendências mentiria "sincronizado" se a
  marcasse confirmada.

Testes de regressão em `src/sync/engine.notes.test.ts` (descrição
"compatibilidade com script antigo"): tarefas sincronizam normalmente,
anotação pendente nunca sai do aparelho nem aparece na chave `notes` do
corpo do push, e - depois que um servidor simulado "reimplantado" (com
`capabilities`) assume - a mesma anotação, ainda pendente, finalmente
sincroniza na próxima chamada.

**Bug real encontrado e corrigido ao escrever esta compatibilidade:**
`isValidData_` (`apps-script/Code.gs`) exigia `Array.isArray(data.notes)`
sem exceção - o que parecia certo (validação estrita do formato), mas tem
uma consequência séria no sentido INVERSO do que esta seção toda discute:
um `matriz.json` já existente no Drive, gravado por uma versão do script
ANTERIOR a esta extensão, não tem a chave `notes` de jeito nenhum.
`readStateFromFolder_` fazia `isValidData_(parsed.data) ? parsed.data :
emptyData_()` - ou seja, a primeira leitura desse arquivo real depois de
reimplantar reprovava a validação e caía para `emptyData_()`, fazendo
**todas as tarefas de verdade "desaparecerem" da tela** (não do Drive -
o arquivo continuava intacto - mas o app não veria nada até um próximo
push reescrever o arquivo do zero). Um bug de leitura, não de escrita,
que só se manifestaria exatamente no momento em que o usuário reimplantar
o script - o pior timing possível para passar batido.

Corrigido com `normalizeData_()`: `isValidData_` passa a tolerar
`data.notes === undefined` (só reprova se a chave existir e NÃO for um
array), e `normalizeData_()` preenche `notes: []` logo depois de validar -
tanto na leitura (`readStateFromFolder_`) quanto na escrita
(`handlePush_`, para um push legado/de um app ainda não atualizado não
quebrar o resto do script que assume `data.notes` sempre array). A
proteção contra encolhimento brusco (`isDrasticShrink_`, já estendida
nesta mesma fase para cobrir anotações) acaba servindo de rede de
segurança adicional nesse segundo caso: um push sem `notes` normalizado
para `[]` só é aceito sem `allowShrink` se o servidor também já tiver
zero anotações - encolher de N para 0 é sempre recusado.

Encontrado revisando o próprio código depois de implementar a
compatibilidade "front novo + script antigo" pedida pelo prompt - ao
pensar no caminho inverso (dados antigos relidos por um script novo),
não por nenhum teste que já existisse. Teste de regressão acrescentado em
`apps-script/test/harness.mjs` ("lê um matriz.json antigo..."),
confirmado que falha sem a correção (reproduz exatamente o
desaparecimento: 0 tarefas em vez de 1) e passa com ela.
