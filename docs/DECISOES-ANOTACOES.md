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
