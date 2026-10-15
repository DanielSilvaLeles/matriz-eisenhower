# Matriz de Eisenhower — guia do repositório

App pessoal de priorização, um único usuário, local-first. Requisitos completos
em `docs/prompt-matriz-eisenhower.md` — esse documento manda; este aqui registra
comandos, convenções e decisões de arquitetura.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | oxlint com regras que usam tipos, zero avisos tolerados |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (domínio, tema, contraste dos tokens) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em `http://localhost:4173/matriz-eisenhower/` |
| `npm run check` | Lint + tipos + testes + build. É o que o CI roda. |

## Arquitetura

**Decisão fechada (não reabrir):** a rede da empresa bloqueia a VPS pessoal e
libera apenas GitHub Pages e Google Apps Script. Por isso o front é 100%
estático, o banco local é a fonte da verdade imediata e o Drive (via Apps
Script) é a cópia compartilhada entre aparelhos. Nada de VPS, túnel ou proxy.

```
src/
  domain/   regras puras, sem React, sem banco, sem rede — tudo com teste
  db/       Dexie: schema e migrations versionadas          (fase 1b)
  sync/     ciclo pull -> merge -> push -> verificação      (fase 2)
  ui/       componentes, hooks, atalhos
  lib/      utilitários genéricos
  styles/   tokens de design e CSS global
apps-script/  backend no Google Apps Script                 (fase 2)
```

Regra de ouro: **toda regra de domínio é função pura em `src/domain`**. A UI e o
banco só orquestram. É o que torna os critérios de aceite testáveis.

## Decisões de arquitetura

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

### shadcn/ui

`components.json` está configurado, mas **nenhum componente foi gerado ainda**.
A fase 1b usou só HTML nativo (`<input type="checkbox">`, `<details>`) porque
cada caso tinha suporte de teclado e leitor de tela de graça, sem precisar do
Radix por trás do shadcn. O primeiro `npx shadcn@latest add <componente>` entra
quando algo realmente exigir o comportamento do Radix (diálogo, combobox da
delegação, popover — prováveis na fase 3) e vai precisar dos tokens de alias do
shadcn (`--color-background`, `--color-primary`, `--color-ring`...) mapeados
sobre os nossos em `tokens.css`. Adicione-os junto com o primeiro componente,
não antes: token sem uso é abstração para o futuro, e o documento pede o simples.

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

## Estado atual

Fase 1b concluída: domínio puro (quadrante, posição fracionária, mutações de
tarefa), Dexie v1 com o repositório de tarefas, e a matriz funcional —
adicionar, concluir, reabrir, contador e aviso de limite, "Concluídas hoje"
colapsado, estado vazio por quadrante, `navigator.storage.persist()`.
Testado manualmente no navegador (claro/escuro, 360px, estouro de limite,
reload com persistência).

Ainda não tem nesta fase: arrastar e soltar, atalhos de teclado, caixa de
entrada, desfazer, backup. Tudo isso é a fase 1c. Fases em
`docs/prompt-matriz-eisenhower.md`, seção 11.
