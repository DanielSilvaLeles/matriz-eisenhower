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
O primeiro `npx shadcn@latest add <componente>` vai precisar dos tokens de alias
do shadcn (`--color-background`, `--color-primary`, `--color-ring`...) mapeados
sobre os nossos em `tokens.css`. Adicione-os junto com o primeiro componente,
não antes: token sem uso é abstração para o futuro, e o documento pede o simples.

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

Fase 1a concluída: esqueleto, tokens, tema, CI/CD e a grade 2x2 vazia no ar.
Próxima: fase 1b (domínio, Dexie e a matriz funcional). Fases em
`docs/prompt-matriz-eisenhower.md`, seção 11.
