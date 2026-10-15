# Matriz de Eisenhower — app pessoal de priorização (v2)

## 1. Seu papel e como trabalhar

Você vai atuar como engenheiro front-end sênior e como designer de produto com forte repertório de UX. O trabalho é construir do zero um app web pessoal, de um único usuário (eu), para priorizar meu trabalho diário com a Matriz de Eisenhower.

Regras de trabalho:

1. Antes de escrever código, leia este documento inteiro, me faça de uma vez só as perguntas que realmente bloqueiam decisões (no máximo 5) e apresente um plano por fases. Espere meu ok.
2. Entregue fase a fase (seção 11). Ao fim de cada fase: rode lint, testes e build, me diga como testar manualmente e pare.
3. Prefira o simples. É um app de um usuário: nada de multi-tenant, filas, microserviços ou abstrações "para o futuro".
4. Crie um `CLAUDE.md` com comandos, convenções e decisões de arquitetura, e mantenha atualizado.
5. Use as versões estáveis atuais das bibliotecas. Confira na documentação em vez de assumir de memória.
6. Regras de domínio (movimentação entre quadrantes, limites, mesclagem de sincronização) têm teste automatizado.
7. Se uma decisão deste documento esbarrar em limitação técnica, me mostre as opções em vez de decidir sozinho.
8. Interface toda em português do Brasil.
9. O repositório será **público**. Nenhum segredo (token, URL privada, dados reais) pode entrar no código, nos testes, nos exemplos ou no histórico do git.

## 2. Contexto

Sou tech manager. Lidero um time de 7 pessoas (5 devs, 1 QA, 1 líder técnico) e acompanho 2 projetos com um fornecedor. Meu dia é cheio de reuniões e as demandas chegam por todos os lados, muitas vezes quando só estou com o celular. Hoje perco anotações e acabo gastando energia no que grita mais alto, não no que importa.

O que eu quero: abrir uma tela e saber em segundos o que faço agora, o que agendo, o que delego e o que corto.

Metas de experiência (use como critério para decisões de design):

- Capturar uma ideia em menos de 5 segundos, em qualquer dispositivo, sem precisar decidir nada na hora.
- Triar 10 itens da caixa de entrada em menos de 1 minuto.
- Caixa de entrada zerada ao final do dia.

### Restrição de ambiente (define a arquitetura)

Preciso usar o app em dois lugares: **no celular** e **no computador da empresa**. A rede da empresa bloqueia o acesso à minha VPS pessoal (domínio e IP), então o app **não pode depender dela**. O que a rede da empresa libera e eu já confirmei: **GitHub Pages** e **Google Apps Script**. Por isso a arquitetura da seção 9 usa só esses dois, e é uma decisão fechada. Não proponha alternativas que dependam da VPS nem túneis, proxies ou redirecionamentos para contornar o bloqueio.

## 3. A Matriz (regras de domínio)

Dois eixos:

- **Urgência**: exige ação imediata, tem prazo ou consequência iminente.
- **Importância**: contribui para objetivos de longo prazo.

| Quadrante | Urgente | Importante | Ação | Cor |
|---|---|---|---|---|
| Q1 | sim | sim | **Fazer** agora | verde |
| Q2 | não | sim | **Agendar** | amarelo |
| Q3 | sim | não | **Delegar** | azul |
| Q4 | não | não | **Eliminar** | vermelho |

Layout canônico: colunas são a urgência (esquerda urgente, direita não urgente) e linhas são a importância (em cima importante, embaixo não importante). Q1 em cima à esquerda, Q2 em cima à direita, Q3 embaixo à esquerda, Q4 embaixo à direita.

Leitura das cores como semáforo: verde é "vai", amarelo é "espera a hora", azul é "passa adiante", vermelho é "pare". Deixe as quatro cores como tokens fáceis de trocar.

Princípios da metodologia que viram regra de produto:

1. **Q1 deve ser pequeno.** Viver em Q1 é viver apagando incêndio. Quando tarefas caem em Q1 repetidamente, é sinal de falha de planejamento. O app registra de onde cada tarefa veio para eu enxergar isso.
2. **Q2 é onde está o valor.** É o trabalho que constrói resultado duradouro. Tarefa de Q2 sem data é só um desejo, então o app pede uma data e facilita bloquear tempo na agenda.
3. **Q3 se delega com contexto.** Delegar bem exige dizer por que é urgente e qual é o resultado esperado. O app ajuda a montar essa mensagem e a cobrar depois.
4. **Q4 se elimina.** Descanso e pausa não são Q4 (são Q2). Q4 é só o que consome tempo sem retorno.
5. **Efeito da mera urgência.** A tendência é priorizar o que parece urgente. Na triagem, o app lembra a pergunta: "isso contribui para meus objetivos ou estou só reagindo à pressão do momento?".
6. **Máximo de 10 tarefas abertas por quadrante.** Acima disso a matriz vira lista e perde a função.
7. **Eliminar primeiro, priorizar depois.** Na triagem, eliminar é sempre a saída mais fácil de alcançar.
8. **Trabalho e pessoal não se misturam.** O app nasce só para trabalho. O modelo de dados já tem o campo de contexto, mas a troca de contexto na interface fica para depois.

## 4. Princípios de UX

1. **Capturar e priorizar são momentos diferentes.** Capturar não pode exigir decisão nenhuma. Priorizar acontece depois, em lote.
2. **A matriz é a home.** Abriu o site, está nos quadrantes. Nada de landing, dashboard ou menu antes.
3. **Um gesto, não um formulário.** Só o título é obrigatório. Todo o resto é opcional e aparece na hora em que faz sentido.
4. **Desfazer em vez de confirmar.** Nenhum modal de "tem certeza?". Toda ação destrutiva ou de movimentação mostra um toast com "Desfazer" por alguns segundos.
5. **Tudo que arrasta tem alternativa.** Arrastar e soltar é o caminho rápido com mouse. Teclado e toque fazem o mesmo por atalho e por menu "Mover para".
6. **A interface orienta sem dar sermão.** Avisos curtos, no lugar onde o problema está, sempre dispensáveis.
7. **Cor nunca vai sozinha.** Cada quadrante tem cor, ícone e rótulo com o verbo da ação.
8. **Resposta instantânea.** Toda ação lê e grava primeiro no banco local. Sem spinner para adicionar, mover ou concluir. A rede nunca bloqueia a interface.
9. **Confiança nos dados.** O estado da sincronização é sempre visível e honesto (seção 6). Nunca mostrar "sincronizado" sem ter verificado.

## 5. Telas e comportamento

### 5.1 Home: a matriz (desktop)

- Grade 2x2 ocupando a maior parte da tela, com os rótulos dos eixos visíveis: "Urgente / Não urgente" no topo e "Importante / Não importante" na lateral.
- Cabeçalho de cada quadrante: verbo da ação (Fazer, Agendar, Delegar, Eliminar), uma linha curta de apoio (ex.: "Urgente e importante") e o contador `n/10`.
- Cada quadrante tem um campo "Adicionar tarefa" sempre visível. Enter adiciona e mantém o foco para a próxima.
- Linha da tarefa: checkbox, título, chips à direita (data, pessoa, tag). Ações secundárias aparecem no hover e no foco.
- Concluir: risca, anima e recolhe para "Concluídas hoje (n)" no rodapé do quadrante, colapsado.
- Arrastar e soltar entre quadrantes, dentro do quadrante para reordenar e da caixa de entrada para um quadrante. A área de destino se destaca durante o arraste.
- Contador: fica em âmbar a partir de 8 e, ao chegar em 10, o quadrante mostra o aviso "Quadrante cheio: conclua, divida ou reclassifique". Não bloqueie a adição (nunca perca uma captura), mas mantenha o aviso enquanto passar de 10.
- Faixa "Hoje" no topo, em uma linha: quantas em Fazer, quantas agendadas para hoje, quantas cobranças de delegação vencem hoje e quantos itens na caixa de entrada. Cada número é clicável e leva ao lugar certo.
- Indicador de sincronização no cabeçalho, sempre visível (seção 6.3).
- Estados vazios com exemplo do meu contexto, um por quadrante (ex.: Q1 "incidente em produção", Q2 "preparar os 1:1 da semana", Q3 "agendar a reunião com o fornecedor", Q4 "reunião de status sem pauta").

### 5.2 Caixa de entrada (captura rápida)

- Painel lateral fixo à direita da matriz, recolhível, com badge do número de itens.
- No topo, o campo de captura. Atalho global `N` foca o campo de qualquer lugar. Enter salva e limpa.
- Texto com várias linhas colado de uma vez vira um item por linha (com opção de desfazer).
- `#tag` no texto vira tag (uso para marcar projeto). Nada mais é interpretado.
- Cada item mostra a origem (web, PWA, compartilhado) e há quanto tempo está parado.
- Item com mais de 24h na caixa ganha destaque discreto.
- Botão "Triar agora" abre o modo triagem.

### 5.3 Modo triagem

Fluxo focado para esvaziar a caixa de entrada, um item por vez.

- O item aparece grande no centro. Abaixo, uma mini matriz 2x2 com os quatro destinos, na mesma posição espacial da home.
- Teclas `1` `2` `3` `4` mandam para o quadrante. `E` edita o texto. `S` pula. `Esc` sai.
- Texto de apoio fixo: "Contribui para meus objetivos ou estou só reagindo à pressão do momento?".
- "Me ajude a decidir" abre duas perguntas de sim ou não (tem prazo ou consequência próxima? aproxima dos meus objetivos?) e sugere o quadrante por regra simples, sem IA.
- Depois de escolher Agendar: chips de data (Amanhã, Esta semana, Semana que vem, Escolher). Pode pular.
- Depois de escolher Delegar: "Para quem?" com autocomplete das pessoas já usadas. Pode pular.
- Barra de progresso (ex.: 3 de 10) e tela final de caixa zerada.

### 5.4 Comportamento por quadrante

Existe um único campo de data por tarefa, e o rótulo muda conforme o quadrante.

- **Q1 Fazer.** Data rotulada "Prazo". Ordem manual. Registre no histórico se a tarefa nasceu em Q1 ou veio de outro quadrante.
- **Q2 Agendar.** Data rotulada "Agendada para". Sem data, mostra o chip "sem data" em âmbar. Ordenada por data. Selos "Hoje" e "Atrasada". Ação "Bloquear na agenda" abre o Google Agenda com o evento pré-preenchido por link (sem OAuth). No dia agendado a tarefa continua em Q2, sobe para o topo com o selo "Hoje". Nada se move sozinho entre quadrantes.
- **Q3 Delegar.** Campos "Para quem" e data rotulada "Cobrar em". Estados: "a delegar" (sem pessoa) e "aguardando Fulano". Ação "Copiar mensagem de delegação" monta um texto com o quê, por que é urgente, resultado esperado e prazo, a partir dos campos da tarefa. No dia da cobrança, selo "Cobrar hoje".
- **Q4 Eliminar.** Soltar aqui é decidir não fazer. O item fica visível e esmaecido até a virada do dia e então é arquivado automaticamente. Pode ser restaurado pelo histórico. Mostre "n eliminadas esta semana" como reforço positivo.

### 5.5 Detalhe da tarefa

Painel lateral (não modal de tela cheia) com: título, notas, quadrante, data, pessoa, contexto da delegação, resultado esperado, tags e uma linha do tempo curta (criada, movida, concluída). Salva sozinho ao editar.

### 5.6 Atalhos de teclado

`N` capturar, setas navegam entre tarefas, `1` a `4` movem a tarefa focada, `0` devolve para a caixa de entrada, `Espaço` conclui, `Enter` abre o detalhe, `T` abre a triagem, `S` sincroniza agora, `Ctrl+Z` desfaz, `?` mostra a ajuda.

### 5.7 Mobile

Quatro listas lado a lado não cabem no celular. No mobile:

- Topo: mini matriz 2x2 fixa. Cada célula tem cor, verbo e contador, e funciona como seletor.
- Meio: lista do quadrante selecionado. Abre em Fazer.
- Acesso à caixa de entrada por um chip com badge acima da mini matriz.
- Base: barra de captura fixa, ao alcance do polegar.
- Mover: toque longo abre uma folha "Mover para" com a mini matriz. Arrastar também funciona.
- Triagem: cartão do item e os quatro botões grandes em 2x2, na mesma posição da matriz.
- Alvos de toque de pelo menos 48px.

### 5.8 Configurações

- URL do Apps Script e token de acesso, com botão "Testar conexão" que diz exatamente o que falhou (URL inválida, token recusado, sem rede, bloqueio da rede).
- Nome do aparelho (ex.: "celular", "pc empresa"), usado na mesclagem e no histórico de sincronização.
- Tema claro, escuro ou do sistema.
- **Exportar backup** (baixa um `.json` com todos os dados) e **Importar backup** (com pré-visualização do que será substituído). É a rede de segurança caso o Drive ou o script falhe.
- URL e token são guardados só no aparelho (armazenamento local do navegador). Nunca vão para o repositório nem para a URL de nenhuma requisição.

### 5.9 Histórico e revisão

- Histórico pesquisável de concluídas e eliminadas, com restaurar.
- Revisão semanal (fase 5): distribuição das tarefas concluídas por quadrante, quantas tarefas de Q1 vieram de Q2 atrasado, tempo médio parado na caixa de entrada, quantas foram eliminadas.

## 6. Sincronização (o coração da arquitetura)

Modelo **local-first**: a fonte da verdade imediata é o IndexedDB do aparelho. O Google Drive (via Apps Script) é a cópia compartilhada entre meus aparelhos.

### 6.1 Fluxo de sincronização

Um ciclo de sync faz, nesta ordem:

1. **Pull:** pede ao script o estado atual (`revision` + dados).
2. **Merge:** mescla com o banco local (regras em 6.2).
3. **Push:** se a mescla gerou diferença em relação ao servidor, envia o resultado informando a `baseRevision` que leu. O script só aceita se a revisão ainda for a mesma. Se outro aparelho gravou no meio, o script responde `conflict`, e o app volta ao passo 1 (até 3 tentativas).
4. **Verificação:** depois de gravar, relê do script e compara o checksum com o do estado local. Só então marca como "Confirmado".
5. Limpa as marcas de pendência **somente após a verificação**. Se qualquer etapa falhar, nada é limpo.

Quando sincronizar:

- Ao abrir o app, ao voltar o foco para a aba e a cada 60 segundos com o app visível.
- 3 segundos depois da última edição (debounce).
- Ao clicar em "Sincronizar agora" (pula debounce e intervalo e executa o ciclo completo na hora).
- Ao voltar a ter conexão (evento `online`).

### 6.2 Regras de mesclagem

- Cada tarefa tem `id` único (UUID gerado no cliente), `updatedAt` (ISO, UTC) e `deleted`.
- Para o mesmo `id`, vence a versão com `updatedAt` mais recente. Empate: desempata pelo nome do aparelho, para o resultado ser determinístico.
- Exclusão é lógica (`deleted: true`), para uma tarefa apagada num aparelho não ressuscitar. Tombstones com mais de 30 dias são removidos na sincronização.
- Pessoas e eventos de histórico são mesclados por `id` (união).
- A função de mesclagem é pura, sem acesso a rede ou banco, com testes cobrindo: edição em dois aparelhos, exclusão vs edição, empate, ressurreição, idempotência (mesclar duas vezes dá o mesmo resultado) e comutatividade (a ordem dos aparelhos não muda o resultado).
- Relógio dos aparelhos pode divergir um pouco. Isso é aceitável para um único usuário, mas registre a limitação no `CLAUDE.md`.

### 6.3 Interface de sincronização

- Indicador sempre visível no cabeçalho: "Sincronizado às 14:32", "Sincronizando...", "3 alterações pendentes", "Offline" ou "Erro".
- Botão **"Sincronizar agora"** (e atalho `S`). Ao terminar, mostra o resumo: "2 enviadas, 1 recebida de outro aparelho. Confirmado."
- Contador de alterações pendentes sempre visível quando houver algo não confirmado.
- Mensagens de erro específicas, com botão "Tentar de novo": sem internet; URL do script inválida; token recusado; resposta inesperada (provável bloqueio da rede ou página de login do Google); conflito persistente após 3 tentativas.
- Aviso ao fechar a aba quando houver pendências.
- O app pede armazenamento persistente (`navigator.storage.persist()`) para o navegador não limpar o banco local por pressão de espaço.

### 6.4 Backend: Google Apps Script

Você deve **gerar o arquivo `apps-script/Code.gs`** e o guia de publicação. Requisitos:

- Web App (`doPost`) executando como o dono do script. Sem uso de Google Cloud, OAuth no front ou API do Drive via REST: o script usa o `DriveApp`/`LockService`/`PropertiesService` nativos.
- **Tudo por POST**, com `Content-Type: text/plain` e corpo JSON (evita pré-voo de CORS e mantém o token fora da URL). Formato: `{ "token": "...", "action": "pull" | "push" | "ping", "baseRevision": n, "data": {...} }`. Resposta sempre JSON: `{ "ok": true, "revision": n, "checksum": "...", "data": {...} }` ou `{ "ok": false, "error": "unauthorized" | "conflict" | "invalid" | "busy" | "server" }`.
- **Token:** guardado nas propriedades do script (`PropertiesService`), nunca no código. Forneça uma função `setupToken()` que gera um valor aleatório forte (mínimo 32 caracteres) e o mostra no log para eu copiar, e uma `rotateToken()`. Compare o token sem vazar informação por diferença de tempo de resposta quando possível. Respostas de erro de autenticação não devem revelar nada sobre os dados.
- **Armazenamento:** um arquivo `matriz.json` numa pasta própria do app no meu Drive, criado automaticamente na primeira chamada. O arquivo guarda `{ revision, updatedAt, data }`.
- **Concorrência:** `LockService` em volta de todo `push`. Conferir `baseRevision` dentro do lock. Se não bater, devolver `conflict` com a revisão atual.
- **Segurança dos dados:** validar que o JSON recebido é bem formado e tem o formato esperado (versão do schema, listas) antes de gravar. Antes de sobrescrever, copiar o arquivo atual para `matriz.bak1.json` (e o antigo `bak1` para `bak2`). Recusar payload que reduza drasticamente o número de tarefas sem a flag explícita `allowShrink` (proteção contra um aparelho com banco vazio apagar tudo).
- Limite de tamanho do payload com erro claro.
- `ping` valida a conexão e o token sem tocar nos dados (usado no "Testar conexão").

Entregue também `apps-script/README.md` com o passo a passo numérico para eu publicar (criar o projeto em script.google.com, colar o código, rodar `setupToken`, implantar como Aplicativo da Web com execução como eu e acesso "Qualquer pessoa", autorizar a permissão do Drive, copiar a URL) e como **reimplantar uma nova versão** depois de atualizar o código, incluindo o aviso de que a URL muda se eu criar uma nova implantação em vez de gerenciar a existente.

## 7. Direção visual

- Cara de ferramenta de trabalho: calma, densa na medida, legível de relance. Não é landing page nem dashboard com cards em gradiente.
- Base neutra. As quatro cores entram só como acento: barra fina no topo do quadrante, ponto ao lado do título e um tom bem leve no cabeçalho. Nunca preencha o quadrante inteiro com cor saturada.
- Q4 visualmente mais recuado (menos contraste), para a hierarquia visual refletir a prioridade.
- Tema claro e escuro, seguindo o sistema, com alternância manual.
- Tipografia escolhida com intenção, com números tabulares para os contadores. Justifique a escolha no plano.
- Tokens de design em variáveis CSS (cores dos quadrantes, espaçamentos, raios).
- Movimento curto (150 a 200 ms) e com propósito. Respeite `prefers-reduced-motion`.
- Acessibilidade: contraste WCAG AA, foco visível, navegação completa por teclado, anúncio de movimentações para leitor de tela.

## 8. PWA e captura pelo celular

Só PWA. Sem Telegram, sem WhatsApp, sem bots.

- Instalável, com manifest e ícones.
- Atalho de app "Nova anotação" que abre direto na captura, com o teclado aberto.
- Share target: texto compartilhado de outros apps cai na caixa de entrada. Use o método GET do `share_target` (funciona em hospedagem estática, sem servidor).
- Service worker com cache do app (abre offline) e estratégia de atualização que avise "Nova versão disponível" em vez de recarregar sozinho no meio de uma edição.
- Captura offline: grava no IndexedDB e fica como pendente até sincronizar, com indicação visual.
- Toda captura, de qualquer origem, passa por uma única função `captureItem({ text, source })`.
- Limitação aceita: não há tempo real. Uma captura no celular chega ao PC no próximo ciclo de sincronização (até cerca de 1 minuto) ou ao clicar em "Sincronizar agora".

## 9. Stack e infraestrutura

Arquitetura **100% estática no front**, sem servidor próprio. Decisão fechada (ver seção 2).

- **Front:** Vite + React + TypeScript + Tailwind, primitivos acessíveis (Radix ou shadcn/ui) e dnd-kit para arrastar e soltar. Plugin de PWA para manifest e service worker.
- **Banco local:** IndexedDB (usar Dexie ou `idb`), com migrations de schema versionadas. Validação dos dados com Zod.
- **Estado de sincronização:** tabela local de pendências (ids alterados desde a última confirmação), última revisão confirmada e checksum.
- **Backend:** Google Apps Script (seção 6.4). Nenhum outro backend.
- **Hospedagem:** GitHub Pages, com URL única para celular e computador da empresa. Configure o `base` do Vite para o nome do repositório, ajuste manifest, `start_url`, `scope` e service worker para o subcaminho, e teste a instalação do PWA nesse subcaminho.
- **CI/CD:** GitHub Actions: instala, roda lint e testes, faz o build e publica no Pages a cada push na `master`.
- **Testes:** Vitest para domínio e mesclagem; Playwright para 3 fluxos essenciais (adicionar e mover tarefa, triagem da caixa de entrada, ciclo de sincronização contra um script simulado).
- Sem variáveis de ambiente secretas. A única configuração sensível (URL e token do script) é digitada por mim em cada aparelho (seção 5.8).

## 10. Modelo de dados (ponto de partida)

Em IndexedDB e espelhado no `matriz.json`:

- `tasks`: id, title, notes, quadrant (`q1` | `q2` | `q3` | `q4` | null para caixa de entrada), status (`open` | `done` | `archived`), position, date, delegated_to, delegation_context, expected_outcome, tags, source (`web` | `pwa` | `share`), context (`work` | `personal`, padrão `work`), created_at, updated_at, completed_at, deleted, device.
- `task_events`: id, task_id, type (`created` | `moved` | `completed` | `reopened` | `archived`), from_quadrant, to_quadrant, at, device. Alimenta a linha do tempo, o desfazer e a revisão semanal.
- `people`: id, name, updated_at. Criada automaticamente na primeira delegação.
- `meta` (só local): device_name, last_confirmed_revision, last_confirmed_checksum, pending_ids, schema_version.
- O `matriz.json` inclui `schemaVersion`. Se o app encontrar um arquivo com versão maior que a que entende, recusa sincronizar e avisa para atualizar o app, em vez de corromper dados.

Pode propor ajustes, mas justifique.

## 11. Fases de entrega

1. **Núcleo local em produção.** Setup, banco local, home com a matriz (adicionar, editar, concluir, arrastar, mover por teclado, desfazer, contador e aviso de limite), caixa de entrada com captura, layout mobile, exportar e importar backup, deploy no GitHub Pages com CI. Ao fim desta fase eu já uso no computador, mesmo sem sincronizar.
2. **Sincronização.** `Code.gs` e README de publicação, cliente de sync, mesclagem com testes, botão "Sincronizar agora", indicador e contador de pendências, tela de configuração com "Testar conexão", erros específicos. Ao fim desta fase eu uso nos dois aparelhos.
3. **Triagem e regras por quadrante.** Modo triagem, data contextual, link para a agenda, delegação com pessoas e mensagem, arquivamento de Q4, faixa "Hoje", detalhe da tarefa, histórico.
4. **PWA completo.** Instalação, atalho de captura, share target, service worker com aviso de atualização, captura offline polida.
5. **Revisão e refinamento.** Revisão semanal, polimento visual e de acessibilidade.

## 12. Critérios de aceite

- A home é a matriz e carrega já com as tarefas do banco local, sem tela intermediária e sem esperar a rede.
- Dá para adicionar uma tarefa em qualquer quadrante só com teclado, sem tocar no mouse.
- Toda movimentação e toda exclusão podem ser desfeitas.
- Toda ação possível com arrastar também é possível por teclado e por toque.
- O app funciona offline depois da primeira visita, e as alterações feitas offline sobem quando a conexão voltar.
- Uma tarefa criada no celular aparece no computador após "Sincronizar agora" nos dois lados, com a mensagem "Confirmado" só depois da releitura e comparação de checksum.
- Se o envio falhar, o contador de pendências continua visível e nada é perdido.
- Duas edições em aparelhos diferentes (uma offline) são mescladas sem perder nenhuma, e uma tarefa apagada não ressuscita.
- Um aparelho com banco vazio não consegue apagar os dados do Drive ao sincronizar.
- O script recusa qualquer chamada sem o token correto, e o token nunca aparece em URL, log do app, repositório ou mensagem de erro.
- Exportar e importar backup restauram o estado completo.
- Usável em 360px de largura e em telas grandes.
- Contraste AA e foco visível em todos os elementos interativos.
- Testes de domínio e de mesclagem passam no CI, e o deploy no Pages acontece sozinho.

## 13. Fora de escopo (por enquanto)

- Vários usuários, times ou compartilhamento.
- Classificação automática por IA. A decisão de urgente e importante é minha e é o exercício central do método.
- Qualquer dependência da minha VPS, do Firebase ou de outros backends.
- Telegram, WhatsApp e captura por voz.
- Integrações com OAuth (Google Agenda, Azure DevOps). O link para a agenda é só um URL pré-preenchido.
- Notificações push.
- Sincronização em tempo real.
