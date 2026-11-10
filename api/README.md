# API da Matriz (VPS + PostgreSQL)

```
PWA (GitHub Pages) → Apps Script (proxy) → api.leles.tec.br/matriz → PostgreSQL
```

A rede da empresa só libera `github.io` e `script.google.com`. O front continua
falando **só** com o Apps Script, com o mesmo contrato de sempre (`ping`/`status`/`pull`/`push`).
O Apps Script repassa a chamada para esta API via `UrlFetchApp`, e a requisição
sai dos servidores do Google, não da rede da empresa.

## Rotas

Todas ficam sob `BASE_PATH` (padrão `/matriz`). Todas, menos `/health`, exigem o cabeçalho `X-Api-Key`.

| Método | Rota | Ação do Apps Script | Respostas |
|---|---|---|---|
| GET | `/health` | `testeVps()` | 200 `{ok, db:"up"}` · 503 `{ok:false, db:"down"}` |
| GET | `/v1/state` | `ping`, `pull` | 200 `{ok, revision, checksum, data}` |
| GET | `/v1/state/status` | `status` | 200 `{ok, revision, checksum}` |
| PUT | `/v1/state` | `push` | 200 · 409 `conflict` · 422 `invalid` · 503 `busy` |

Erros vêm sempre como `{ ok: false, error }`, com o mesmo vocabulário do Code.gs
(`unauthorized`, `conflict`, `invalid`, `busy`, `server`) mais `not_found`.
A API não envia cabeçalho CORS: só o `UrlFetchApp` chama esta API.

O `PUT` recebe `{ baseRevision, data, allowShrink? }` e roda numa transação só:

1. trava `sync_state` e confere `baseRevision` com a trava já tomada;
2. recusa encolhimento drástico se `allowShrink` não vier;
3. guarda a versão anterior em `sync_snapshots` (as duas últimas, o equivalente aos antigos bak1/bak2);
4. faz upsert de cada entidade e apaga o que não veio;
5. relê as linhas e calcula o checksum.

Não existe endpoint de lote: o push já manda o documento inteiro numa chamada só.

## Decisões que não podem ser desfeitas sem quebrar o sync

- **O `updated_at` do domínio é o do cliente.** A mesclagem "vence o mais
  recente" e o checksum de verificação dependem dele. O registro do servidor
  fica em `server_created_at`/`server_updated_at`, mantidas pelo banco
  (default + trigger). Elas só mudam quando a linha muda de verdade, e nunca
  vão na resposta.
- **Cada valor volta exatamente como entrou.** O front relê os dados e
  recalcula o checksum, então qualquer normalização quebraria a confirmação:
  - `date` volta como texto (o parser do `pg` foi trocado em `db.ts`);
  - `timestamptz` volta por `toISOString()`;
  - `favorite` ausente vira `NULL` no banco e continua ausente na volta, porque `false` é outra coisa para o checksum;
  - chaves sem coluna própria vão para `extra jsonb`.
- **A validação recusa (`invalid`) o que o Postgres não devolveria idêntico:**
  timestamp fora do formato `...sssZ`, uuid com maiúsculas e o caractere NUL.
- **O checksum é a terceira cópia da mesma canonicalização** (front e Code.gs
  são as outras duas). `test/checksum.test.ts` confere esta cópia contra a
  função do front importada direto.

## Rodar os testes localmente

```bash
docker run -d --name matriz-api-testdb -e POSTGRES_USER=matriz -e POSTGRES_PASSWORD=teste \
  -e POSTGRES_DB=matriz_test -p 55432:5432 postgres:15-alpine
cd api && npm ci
TEST_DATABASE_URL=postgres://matriz:teste@localhost:55432/matriz_test npm test
```

Sem `TEST_DATABASE_URL`, os testes que dependem do banco são pulados. Eles nunca
apontam para outro banco por engano, e zeram o schema `public` do banco de teste.

## Importar o JSON do Drive

```bash
docker exec -i matriz-api node scripts/import.ts --dry-run < matriz.json
docker exec -i matriz-api node scripts/import.ts < matriz.json
```

- É idempotente e preserva a revisão do arquivo.
- Recusa importar por cima de um banco que já está à frente do arquivo. `--force` passa por cima dessa trava.
- No fim, mostra a quantidade por entidade e o checksum dos dois lados.
