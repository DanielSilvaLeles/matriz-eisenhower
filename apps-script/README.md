# Publicar o backend no Google Apps Script

Passo a passo para colocar `Code.gs` no ar. Precisa ser feito uma vez; a
seção **Reimplantar** no fim é o que você repete depois, sempre que mudar o
código.

Nada aqui pede Google Cloud, OAuth no front ou cartão de crédito — é tudo
gratuito, dentro da sua conta pessoal do Google.

## Publicar pela primeira vez

1. Abra **[script.google.com](https://script.google.com)** e clique em
   **Novo projeto**.
2. Dê um nome ao projeto (ex.: "Matriz de Eisenhower") clicando no título
   "Projeto sem título" no topo.
3. Apague o conteúdo padrão do arquivo `Code.gs` que já vem aberto e cole o
   conteúdo inteiro de [`Code.gs`](./Code.gs) deste repositório.
4. Salve (ícone de disquete, ou `Ctrl+S`/`Cmd+S`).
5. No menu de funções (a lista suspensa ao lado do botão **Depurar**, acima
   do editor), escolha a função **`setupToken`** e clique em **Executar**.
   - Na primeira execução o Google vai pedir autorização: clique em
     **Revisar permissões**, escolha sua conta, confirme em **Avançado →
     Acessar [nome do projeto] (não seguro)** (o aviso aparece porque o
     script é seu, não revisado pela loja do Google) e **Permitir**. É aqui
     que o script ganha permissão para usar `DriveApp` na sua conta.
   - Depois de rodar, abra **Ver → Registros de execução** (ou `Ctrl+Enter`).
     Vai aparecer uma linha como:
     ```
     Token criado — copie para a tela de Configurações do app:
     a1b2c3d4e5f6...
     ```
     **Copie esse valor agora** — ele não aparece de novo em lugar nenhum
     (o script guarda só o token, não o log). Você vai colar na tela de
     Configurações do app, no aparelho.
6. Rode também a função **`testChecksum`** (mesmo menu suspenso) e confira
   no log que a última linha diz **"✓ Bate"**. Se disser "✗ NÃO bate",
   pare e peça ajuda antes de publicar — significa que o cálculo de
   checksum do script divergiu do app, e a sincronização nunca vai
   conseguir confirmar uma gravação.
7. Clique em **Implantar → Nova implantação**.
8. No ícone de engrenagem ao lado de "Selecionar tipo", escolha
   **Aplicativo da Web**.
9. Preencha:
   - **Descrição**: algo como "v1" (fica só de anotação sua).
   - **Executar como**: **Eu** (sua conta) — é isso que deixa o script usar
     o `DriveApp` como você, sem o app pedir OAuth para cada aparelho.
   - **Quem pode acessar**: **Qualquer pessoa** — parece assustador, mas
     **ninguém entra sem o token**: toda ação do script exige o token certo
     no corpo da requisição (seção de segurança abaixo), e sem ele toda
     chamada volta `unauthorized` sem revelar nada sobre os dados. É esse
     nível de acesso, e não um mais restrito, que permite ao *app* (sem
     login Google) chamar o script de qualquer aparelho.
10. Clique em **Implantar**. Autorize de novo se pedir.
11. Copie a **URL do aplicativo da Web** que aparece (termina em `/exec`).
    Essa é a URL que vai na tela de Configurações do app, junto com o token
    do passo 5.
12. Clique em **Concluído**.

Pronto: cole a **URL** e o **token** na tela de Configurações do app, em
cada aparelho, e clique em "Testar conexão" para confirmar.

## Reimplantar depois de mudar o código

Sempre que atualizar `Code.gs` (uma correção, uma funcionalidade nova):

1. Cole o código novo no editor, substituindo o antigo. Salve.
2. Rode a função **`testChecksum`** de novo (mesmo menu suspenso do passo 6
   da primeira publicação) e confira "✓ Bate" no log — qualquer mudança no
   formato dos dados (como a extensão "Anotações" abaixo) muda o cálculo
   de checksum nos dois lados juntos; se só um lado for colado, a
   sincronização nunca mais confirma nenhuma gravação.
3. Clique em **Implantar → Gerenciar implantações**.
4. Ao lado da implantação ativa (a que foi criada no passo 7-10 acima),
   clique no ícone de lápis (editar).
5. Em **Versão**, escolha **Nova versão**.
6. Clique em **Implantar**.

### Extensão "Anotações" (fase 2 de `docs/prompt-anotacoes.md`)

Esta versão do `Code.gs` ganhou: a ação `status` (so revision+checksum,
sem `data` — o app usa para não puxar o arquivo inteiro quando nada
mudou), validação do campo `notes` no payload, a mesma proteção contra
encolhimento brusco (`allowShrink`) agora cobrindo anotações também, e um
campo novo `capabilities: { notes: true, status: true }` em toda resposta
de sucesso.

**Não precisa reimplantar às pressas — o app novo já funciona com o script
antigo, de propósito.** O front detecta a AUSÊNCIA de `capabilities` numa
resposta (um script publicado antes desta extensão nunca manda esse campo)
e entra em modo de compatibilidade sozinho: tarefas continuam
sincronizando normalmente (checksum calculado do jeito antigo, sem a chave
`notes`), e as anotações ficam só neste aparelho - nunca enviadas, sempre
marcadas pendentes - com um aviso discreto ("Script desatualizado:
reimplante a nova versão para sincronizar anotações") no indicador de
sincronização, até você reimplantar. Nenhum dado é perdido nem a
sincronização de tarefas para de funcionar nesse meio-tempo. Reimplante
quando for conveniente para as anotações passarem a sincronizar entre os
aparelhos também.

**A URL continua a mesma** — é exatamente por isso que o passo certo é
**editar a implantação existente**, não criar uma implantação nova. Se você
clicar em "Nova implantação" (em vez de "Gerenciar implantações → editar")
por engano, o Google gera uma **URL diferente**, e você teria que trocar a
URL em todos os aparelhos de novo. Guarde esse aviso.

## Trocar o token (rotação)

Se desconfiar que o token vazou, ou só por precaução periódica:

1. No editor, rode a função **`rotateToken`** (mesmo jeito do passo 5
   acima).
2. Copie o novo valor do log.
3. Atualize o token na tela de Configurações do app, em **todos** os
   aparelhos — o token antigo para de funcionar na hora.

## Onde os dados ficam

Na primeira sincronização, o script cria uma pasta **"Matriz de
Eisenhower"** no seu Google Drive, com um arquivo `matriz.json` (o estado
atual) e, a partir da segunda gravação, `matriz.bak1.json` e
`matriz.bak2.json` (as duas gravações anteriores, por segurança). Nada
disso precisa de manutenção manual — é tudo automático.

## Segurança, em resumo

- O token fica só nas propriedades do script (`PropertiesService`), nunca
  no código-fonte nem no repositório.
- Toda chamada sem o token certo volta `unauthorized`, sem revelar nada
  sobre os dados guardados.
- O token é comparado por um método que não vaza informação pelo tempo de
  resposta (`timingSafeEqual_` em `Code.gs`).
- Antes de sobrescrever `matriz.json`, o script guarda as duas versões
  anteriores (`matriz.bak1.json`, `matriz.bak2.json`).
- Um envio que reduziria o número de tarefas para menos da metade do que
  já está salvo é recusado, a não ser que peça isso explicitamente — trava
  de segurança contra um aparelho com o banco local vazio apagar tudo sem
  querer.

## Testando sem publicar de verdade

`apps-script/test/harness.mjs` simula `DriveApp`, `PropertiesService`,
`LockService` e `Utilities` em memória e roda `Code.gs` de verdade por
cima, sem precisar de conta Google nem publicar nada. É o que o CI roda a
cada push (`npm run test:gas`). Útil para testar uma mudança no código
antes de colar no editor do Apps Script.
