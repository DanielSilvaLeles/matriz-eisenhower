# Extensão: Anotações + menu inferior de acesso rápido

## 1. Como trabalhar nesta extensão

Esta é uma **extensão do projeto que já existe**. Não recomece nada.

1. Todas as fases do SPEC original já foram concluídas. Use o contexto atual e o `CLAUDE.md`, que reflete o estado do projeto. Não releia o `docs/SPEC.md` inteiro: consulte-o só se precisar conferir uma regra específica.
2. Olhe o código real das áreas que esta extensão toca (banco local, sincronização, `Code.gs`, navegação mobile e atalhos) antes de propor o plano. Se algo deste prompt conflitar com o que já existe, escolha a opção mais segura e registre a diferença e o motivo em `docs/DECISOES-ANOTACOES.md`.
3. **Modo autônomo: não pare para perguntar nem para esperar aprovação.** Vou deixar você trabalhando sem supervisão durante o expediente e só volto para ver o resultado final. Escreva o plano em `docs/PLANO-ANOTACOES.md` e comece a executar em seguida. Diante de qualquer dúvida, escolha a opção mais simples e mais segura e registre a decisão e o motivo em `docs/DECISOES-ANOTACOES.md`. A única exceção é um bloqueio real (por exemplo, um teste que continua falhando depois de 3 tentativas de correção): registre no relatório, deixe commitado o que está funcionando e siga para o que não depende do bloqueio.
4. Mantenha as regras do SPEC: interface em português do Brasil, local-first, **repositório público sem nenhum segredo ou dado real**, desfazer em vez de confirmar, resposta instantânea, acessibilidade AA, testes de domínio no CI.
5. Execute as 3 fases da seção 10 em sequência, sem parar entre elas. Ao fim de cada fase: lint, testes e build. Se algo falhar, corrija antes de seguir para a próxima.
6. **Segurança do trabalho sem supervisão (obrigatório):**
   - Trabalhe numa branch `feature/anotacoes`, com um commit por funcionalidade ou fase. **Nunca faça merge nem push na `master` e nunca faça `git push` de nenhuma branch.** O push na `master` publica o site no GitHub Pages, e eu uso o app em produção durante o dia.
   - Não toque em nada fora da pasta do projeto, e não faça nenhuma chamada ao Apps Script real nem a qualquer serviço externo. Os testes de sincronização usam o script simulado.
   - A migration do banco local e do `matriz.json` deve ter teste com dados no formato **atual** (fixtures), provando que tarefas, pessoas e histórico existentes sobrevivem intactos. Nenhum dado existente pode ser perdido ou reescrito de forma incompatível.
   - **Compatibilidade com o script antigo:** o `Code.gs` já publicado só será reimplantado por mim depois. O front novo precisa funcionar com ele: se o script não suportar a ação `status` ou a coleção de anotações (detecte pelo `ping`, que deve passar a informar a versão e as capacidades do script), o app continua sincronizando as tarefas normalmente, mantém as anotações apenas locais e mostra o aviso "Script desatualizado: reimplante a nova versão para sincronizar anotações". Nunca falhar nem perder dados por causa dessa diferença.
7. Ao terminar, atualize o `CLAUDE.md` e entregue `docs/RELATORIO-ANOTACOES.md` com: o que foi feito em cada fase, o que foi testado e o resultado, as decisões tomadas, o que ainda depende de mim (incluindo o passo a passo de reimplantar o `Code.gs`), limitações conhecidas e um **roteiro de teste manual de 10 minutos**. Verifique cada critério de aceite da seção 11 por teste automatizado quando possível, e liste no relatório os que só dá para validar manualmente (teclado do celular, instalação do PWA, sincronização real entre aparelhos).
8. **Build para dois repositórios (produção e beta) sem conflito de dados.** Vou publicar esta branch num segundo repositório público (`matriz-eisenhower-beta`) para testar no celular e no computador da empresa antes de mexer na produção. Eu mesmo faço o push para o beta, você não faz push de nada. Os dois sites ficam no mesmo domínio `github.io`, e o navegador isola dados por domínio e não por caminho, então sem isolamento o beta abriria e migraria o banco real da produção. Implemente:
   - O workflow de deploy calcula o `base` do Vite e um `VITE_APP_ID` a partir de `github.event.repository.name`, para o mesmo código funcionar nos dois repositórios. Ele deve disparar em push nas branches `master` e `main`.
   - **Para o repositório de produção atual, nada muda:** nome do banco IndexedDB, chaves de localStorage, nomes de cache do service worker, `id`, `start_url`, `scope` e nome no manifest continuam exatamente iguais aos de hoje (descubra os valores atuais no código). Dados existentes não podem ser orfanados.
   - Para qualquer outro repositório (nome terminado em `-beta`), prefixe com o app ID o nome do banco, as chaves de localStorage e os caches, e use `id`, `start_url`, `scope` e nome próprios no manifest ("Matriz (beta)"), para instalar como PWA separado.
   - Selo "BETA" visível no cabeçalho quando o app não for o de produção.
   - Teste automatizado garantindo que dois app IDs diferentes não compartilham nenhuma chave de armazenamento, e que o app ID de produção gera exatamente os nomes atuais.
   - No `Code.gs`, os nomes da pasta e do arquivo de dados devem vir de propriedades do script (`PropertiesService`) com **os valores atuais como padrão**, para eu poder publicar uma cópia do script no beta apontando para outro arquivo, sem editar o código. O README do script deve explicar como criar essa cópia de teste.
   - Documente no `CLAUDE.md` e no relatório como publicar no beta e como o app ID funciona.

## 2. Objetivo

Hoje o app prioriza tarefas. Quero que ele também seja o lugar onde eu **anoto o que acontece no dia**, principalmente **durante reuniões**, e consulto depois em uma lista com o texto e a **data de inclusão**.

Metas de experiência:

- Abrir uma anotação nova e já estar digitando em menos de 2 segundos, no celular e no computador.
- Nunca perder texto digitado, mesmo se a aba fechar, o app travar ou a internet cair.
- Achar uma anotação antiga em menos de 10 segundos (busca e data).
- Transformar uma ação anotada numa tarefa da caixa de entrada com um gesto.

### Dois conceitos que não podem se misturar

| Conceito | Para que serve | Onde vive |
|---|---|---|
| **Ideia** | captura rápida de uma linha ("cobrar fornecedor X"), que depois vai ser triada em um quadrante | caixa de entrada que já existe |
| **Anotação** | texto livre mais longo, feito durante reunião ou conversa, para consulta posterior | nova área "Anotações" |

"Criar uma ideia" no menu inferior abre exatamente a captura da caixa de entrada que já existe. Se você entender que "ideia" deveria ser outra coisa, pergunte antes de implementar.

## 3. Menu inferior (acesso rápido)

### 3.1 No celular (e telas estreitas)

Barra fixa na base da tela com **4 destinos**, na ordem:

1. **Matriz** (home). Mostra badge com o número de itens na caixa de entrada.
2. **Ideia** (ação, não tela). Abre uma folha inferior com o campo de captura já focado e o teclado aberto. Enter salva, limpa e mantém aberto para a próxima. Fechar descarta nada: o que foi digitado fica salvo.
3. **Anotar** (ação, destaque visual como botão principal central). Cria uma anotação nova e abre o editor focado.
4. **Anotações** (tela com a lista).

Regras:

- Esta barra **substitui** a "barra de captura fixa na base" descrita na seção 5.7 do SPEC. Não pode haver duas barras empilhadas.
- Respeitar a área segura do aparelho (`env(safe-area-inset-bottom)`).
- Com o teclado aberto, a barra não pode cobrir o campo de digitação nem empurrar o conteúdo de forma estranha. Oculte a barra enquanto um editor estiver focado, ou mantenha-a acima do teclado, o que funcionar melhor nos navegadores móveis. Teste no Chrome Android e no Safari iOS.
- Alvos de toque de pelo menos 48px, com rótulo de texto visível sob cada ícone (cor e ícone nunca vão sozinhos).
- Item ativo com destaque claro e `aria-current`.
- A barra aparece nas telas de Matriz e Lista de anotações. No editor de anotação em tela cheia, ela dá lugar a uma barra de edição com "Voltar" e estado de salvamento.

### 3.2 No desktop

Sem barra inferior. O cabeçalho ganha navegação por abas **Matriz | Anotações** e dois botões visíveis: **+ Ideia** e **+ Anotação**. Atalhos: `N` já existe e continua sendo "ideia"; novos: `A` nova anotação, `L` lista de anotações, `/` busca nas anotações. Atualize a ajuda do `?`.

### 3.3 Roteamento

O site é estático no GitHub Pages, sem servidor. Use **roteamento por hash** (`#/anotacoes`, `#/anotacoes/ID`) para que links diretos e recarregar a página funcionem no subcaminho do repositório e no PWA instalado.

### 3.4 PWA

Adicione o atalho de app "Nova anotação" ao manifest, ao lado do "Nova anotação rápida/ideia" que já existe, abrindo direto no editor. Garanta que o nome de cada atalho deixe claro o que é ideia e o que é anotação.

## 4. Tela de anotações (lista)

- Ordem padrão: **da mais recente para a mais antiga**, com opção de inverter.
- Agrupada por dia, com cabeçalhos "Hoje", "Ontem" e depois a data completa ("quarta, 14/10/2026").
- Cada linha mostra: título (ou a primeira linha se não houver título), prévia de até 2 linhas do texto, tags e a **data e hora de inclusão** em formato absoluto (`15/10 14:32`). Se a anotação foi editada depois, mostre também "editada 16:05" de forma discreta.
- **Busca** no texto e no título, instantânea, local, ignorando acentos e maiúsculas, com o trecho encontrado destacado.
- **Filtros:** por tag (`#projeto`), por período (Hoje, 7 dias, 30 dias, intervalo de datas). Filtros combináveis e com botão "Limpar".
- Lista longa precisa continuar rápida: virtualização ou paginação se passar de umas 200 anotações.
- Estado vazio útil, com um botão "Criar a primeira anotação" e uma frase explicando a diferença entre ideia e anotação.
- Fuso e formatos sempre `pt-BR`, fuso `America/Sao_Paulo`.
- Desktop: layout em dois painéis (lista à esquerda, anotação aberta à direita). Celular: lista, e a anotação abre em tela cheia com "Voltar".

## 5. Editor de anotação

- Campo de **título opcional** e **corpo em texto simples** (textarea que cresce). Sem editor de texto rico, sem dependência pesada: o foco é velocidade e confiabilidade durante a reunião.
- **A anotação só passa a existir quando eu digito o primeiro caractere.** Anotação vazia ao sair é descartada em silêncio (sem lixo na lista).
- **Salvamento automático** no banco local, com debounce curto (cerca de 500 ms), e salvamento imediato em `blur`, `visibilitychange` e `pagehide`. Indicador discreto "Salvo" / "Salvando...". Nunca pode haver perda de texto digitado.
- **Data de inclusão** (`created_at`) é definida na criação e **nunca muda**. Mostre "Incluída em 15/10/2026 14:32" no cabeçalho. `updated_at` muda a cada edição.
- Botão e atalho **"Inserir hora"** (`Ctrl+;`), que escreve `[14:32]` na posição do cursor. Serve para marcar o ritmo da reunião.
- Tags com `#nome` no texto, extraídas automaticamente (mesma lógica das tags da caixa de entrada).
- Comportamentos de lista mínimos: ao dar Enter numa linha que começa com `- ` ou `[ ] `, a nova linha continua o mesmo marcador.
- Excluir: toast com "Desfazer". A anotação excluída fica 30 dias numa área "Excluídas recentemente" (dentro de Histórico), podendo ser restaurada.
- Fonte e espaçamento confortáveis para leitura longa. Funciona com teclado completo e com leitor de tela.

### 5.1 De anotação para tarefa (o elo com a matriz)

Linhas que começam com `[ ]` ou `- [ ]` são **itens de ação** em potencial.

- No modo de leitura da anotação, cada linha assim mostra um botão "→ Caixa de entrada".
- No modo de edição, selecionar um trecho de texto oferece "Enviar para caixa de entrada".
- Ao enviar, cria um item na caixa de entrada com o texto da linha, `source` igual a `note` e `source_note_id` apontando para a anotação, e troca o marcador da linha por `[→]` para eu ver que já foi enviada. Evite duplicar: uma linha já marcada com `[→]` não é enviada de novo sem eu pedir.
- No detalhe da tarefa, um link "Ver anotação de origem" abre a anotação.

## 6. Modelo de dados e sincronização

### 6.1 Dados

Nova tabela local `notes`: `id` (UUID), `title`, `body`, `tags`, `created_at`, `updated_at`, `deleted`, `deleted_at`, `device`. A tabela `tasks` ganha `source_note_id` (opcional) e o valor `note` em `source`.

O `schemaVersion` do `matriz.json` sobe, com **migration** do IndexedDB e do arquivo. Um aparelho com app antigo que encontrar versão maior recusa sincronizar e avisa para atualizar (regra que já existe no SPEC).

### 6.2 Mesclagem de anotações (cuidado extra: texto é mais valioso que tarefa)

Para tarefas, "vence o `updatedAt` mais recente" basta. Para anotações isso pode **perder texto**. Por isso:

- Mesma anotação sem edição concorrente: vence a mais recente, como no SPEC.
- **Edição concorrente** (a anotação tem alterações locais pendentes e o servidor trouxe uma versão diferente, também editada depois da última sincronização confirmada): **não descarte nenhuma versão**. Mantenha a vencedora no lugar original e salve a outra como **cópia de conflito** ("Título (conflito 15/10 14:32 do aparelho X)"), com um aviso discreto para eu revisar e apagar o que não quiser.
- Exclusão lógica com `deleted`, igual às tarefas. A exclusão não pode apagar uma edição mais recente feita em outro aparelho: edição posterior à exclusão ressuscita a anotação com aviso.
- Testes obrigatórios de mesclagem: duas edições concorrentes (gera cópia de conflito), edição vs exclusão, criação em dois aparelhos, idempotência, comutatividade e preservação de `created_at`.

### 6.3 Desempenho da sincronização com o volume de texto

Anotações crescem muito mais que tarefas, e hoje cada ciclo baixa o arquivo inteiro. Ajuste o desenho do backend:

- Nova ação `status` no Apps Script, que devolve só `revision` e `checksum` sem os dados. O app só faz o pull completo quando a revisão mudou.
- **Avalie e me proponha** separar os dados em arquivos por coleção no Drive (`matriz.json` para tarefas, `notas.json` para anotações), cada um com sua própria revisão, trava e backups rotativos, para que editar uma tarefa não obrigue a transferir todas as anotações. Se achar que não compensa para o volume esperado (centenas de anotações por ano), justifique e mantenha um arquivo só.
- Respeite o limite de payload do Apps Script. Se o arquivo de anotações se aproximar do limite, o app deve avisar com antecedência e sugerir exportar e arquivar anotações antigas, em vez de falhar silenciosamente.
- O Apps Script continua protegendo contra encolhimento brusco (`allowShrink`) também para anotações.
- O botão "Sincronizar agora", o contador de pendências e a verificação por releitura passam a cobrir tarefas **e** anotações.
- O conteúdo das anotações **nunca** aparece em logs, mensagens de erro, nomes de arquivo ou na URL das requisições.

## 7. Backup e exportação

- O "Exportar backup" já existente passa a incluir as anotações, e o "Importar backup" também as restaura (com pré-visualização do que será substituído).
- Novo: **"Exportar anotações em Markdown"**, gerando um único arquivo `.md` com as anotações em ordem cronológica, um cabeçalho por anotação com data e hora de inclusão, título, tags e texto. Serve para levar o conteúdo para outras ferramentas.

## 8. Direção visual e acessibilidade

- Mesma linguagem visual do app: calma, densa na medida, neutra. As cores dos quadrantes continuam exclusivas da matriz. A parte de anotações usa só neutros e o acento do app, para não parecer outro quadrante.
- O botão central "Anotar" da barra inferior é o único elemento de destaque forte na barra.
- Tema claro e escuro, `prefers-reduced-motion`, contraste AA, foco visível e navegação completa por teclado.
- Textos de interface em pt-BR e tom direto.

## 9. Fora de escopo

- Editor de texto rico, imagens, anexos e áudio.
- Pastas, hierarquias e links entre anotações.
- Classificação ou resumo automático por IA.
- Compartilhamento de anotações com outras pessoas.
- Notificações e lembretes.

## 10. Fases

1. **Anotações locais + menu inferior.** Tabela e migration, rotas por hash, lista com busca e filtros, editor com salvamento automático, menu inferior no celular, abas e atalhos no desktop, atalho do PWA, exclusão com desfazer e lixeira. Ao fim desta fase eu já anoto reuniões, mesmo sem sincronizar.
2. **Sincronização de anotações.** Ação `status`, decisão sobre arquivos por coleção, mesclagem com cópia de conflito, testes de mesclagem, cobertura do botão "Sincronizar agora" e do contador de pendências, aviso de limite de tamanho. Inclui atualizar o `Code.gs` e o README de publicação, **com o passo de reimplantar uma nova versão** do script (lembrando que a URL deve ser mantida).
3. **Elo com a matriz e exportação.** Envio de linhas de ação para a caixa de entrada, "Ver anotação de origem", exportação em Markdown e inclusão das anotações no backup.

## 11. Critérios de aceite

- Em até 2 segundos depois de tocar em "Anotar" no celular, o cursor está no editor com o teclado aberto.
- Fechar a aba, travar o navegador ou ficar offline no meio de uma anotação não perde nenhum texto já digitado.
- A lista mostra o texto, a data e a hora de inclusão, ordenada da mais recente para a mais antiga, com busca e filtros funcionando offline.
- A data de inclusão de uma anotação nunca muda depois de criada.
- No celular, existe uma única barra inferior, com Matriz, Ideia, Anotar e Anotações, sem cobrir o teclado nem o campo de digitação.
- "Ideia" cria um item na caixa de entrada, e "Anotar" cria uma anotação. Os dois nunca se confundem.
- Duas edições da mesma anotação em aparelhos diferentes não perdem texto: uma vira cópia de conflito.
- Uma anotação criada no celular aparece no computador após "Sincronizar agora", com "Confirmado" só depois da releitura.
- Uma linha `[ ]` enviada para a caixa de entrada cria uma tarefa ligada à anotação de origem, sem duplicar.
- O conteúdo das anotações não aparece em URL, log do app, repositório ou mensagens de erro.
- Exportar e importar backup preservam as anotações, e a exportação em Markdown abre corretamente em qualquer editor de texto.
- Testes de domínio e de mesclagem passam no CI.
