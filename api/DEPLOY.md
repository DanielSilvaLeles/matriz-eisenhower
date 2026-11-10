# Publicar a API na VPS, virar o armazenamento e voltar atrás

Este roteiro é para **produção** (`matriz-eisenhower`). Nenhum passo mexe
nos outros containers, bancos ou sites da VPS. O JSON do Drive fica intocado
até você confirmar que está tudo certo.

Os comandos `$` rodam na VPS. Os nomes `postgres` (serviço do banco no compose)
e `/home/apps/matriz-eisenhower` (clone do repositório) são **suposições**:
ajuste se forem outros.

## 1. Código na VPS

```bash
$ cd /home/apps
$ git clone https://github.com/DanielSilvaLeles/matriz-eisenhower.git
```

O repositório é público, então não precisa de chave de deploy. Ele não tem
nenhum segredo, porque tudo sensível fica no `.env`.

## 2. Banco e usuário dedicados

```bash
$ SENHA=$(openssl rand -hex 24); echo "$SENHA"   # anote
$ docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U <superusuario> -v senha="$SENHA" \
    < matriz-eisenhower/api/deploy/create-database.sql
```

Isso cria o usuário `matriz_app` e o banco `matriz`, que pertence a ele. Nenhum
outro usuário consegue conectar nesse banco. As tabelas são criadas pela
própria API quando ela sobe pela primeira vez (migrations).

## 3. `.env` e compose

Acrescente estas duas linhas em `/home/apps/.env`:

```bash
MATRIZ_DATABASE_URL=postgres://matriz_app:<SENHA>@postgres:5432/matriz
MATRIZ_API_KEY=<openssl rand -hex 32>    # guarde: vai também no Apps Script
```

Depois, cole o conteúdo de `api/deploy/docker-compose.snippet.yml` dentro de
`services:` no `/home/apps/docker-compose.yml` e suba o serviço:

```bash
$ cd /home/apps
$ docker compose config --quiet && docker compose build matriz-api && docker compose up -d --no-deps matriz-api
$ docker logs matriz-api        # "migrations aplicadas: 001_initial.sql" e "ouvindo em 0.0.0.0:5002/matriz"
$ curl -s http://127.0.0.1:5002/matriz/health      # {"ok":true,"db":"up"}
```

`--no-deps` garante que só o `matriz-api` sobe. O Postgres e as outras apps não
são reiniciados.

## 4. Nginx e certificado

- **Se `api.leles.tec.br` já existe:** cole `api/deploy/nginx-location.conf`
  dentro do bloco `server` 443 desse host. O certificado atual já cobre o
  domínio.
- **Se ainda não existe:** use `api/deploy/nginx-site-novo.conf`, que traz os
  comandos do Certbot no cabeçalho, e crie o registro DNS `api` no Cloudflare
  com proxy ligado (nuvem laranja).

```bash
$ sudo nginx -t && sudo systemctl reload nginx
$ curl -s https://api.leles.tec.br/matriz/health   # {"ok":true,"db":"up"}
$ curl -s -o /dev/null -w "%{http_code}\n" https://api.leles.tec.br/matriz/v1/state   # 401
```

## 5. Deploy automático (GitHub Actions)

No repositório `matriz-eisenhower` (Settings → Secrets and variables → Actions):

- **secrets:** `VPS_IP`, `VPS_USER` e `VPS_SSH_KEY`, os mesmos dos outros repositórios;
- **variável:** `VPS_DEPLOY` = `true`.

O workflow `.github/workflows/api.yml` roda os testes contra um Postgres 15 e,
só onde `VPS_DEPLOY` for `true`, faz SSH → `git pull` → `docker compose build matriz-api` →
`up -d --no-deps matriz-api` → confere o `/health`. Ele só dispara quando
muda algo em `api/` ou `apps-script/`.

## 6. Backup

O `backup-db.sh` precisa incluir o banco novo. Para conferir:

```bash
$ grep -nE "pg_dumpall|pg_dump|DATABASES|for .* in" /usr/local/bin/backup-db.sh
```

| O script usa | O banco `matriz` está coberto? | O que fazer |
|---|---|---|
| `pg_dumpall` | sim | nada |
| `pg_dump` com uma lista fixa de bancos | não | acrescentar `matriz` na lista |
| `pg_dump` num laço sobre `SELECT datname FROM pg_database` | sim | nada |

Depois do primeiro backup, confirme que o dump tem as tabelas:

```bash
$ ls -lt <pasta-dos-backups> | head      # um arquivo do banco matriz, de hoje
$ zcat <dump-da-matriz>.sql.gz | grep -c "COPY public.tasks"   # >= 1
```

## 7. Cloudflare (o ponto mais provável de falha)

O `UrlFetchApp` sai de IPs do Google com o User-Agent
`Mozilla/5.0 (compatible; Google-Apps-Script; ...)`. Para o Bot Fight Mode e
para o WAF, isso parece um robô, e a resposta costuma ser uma página HTML de
desafio (403/503 "Just a moment...").

**Diagnóstico:** com o `MATRIZ_API_URL` configurado, rode `testeVps()` no
editor do Apps Script.

- `/health → HTTP 200: {"ok":true...}`: o caminho está liberado.
- `/health → HTTP 403: <!DOCTYPE html>...`: o Cloudflare está bloqueando. Na
  aba Security → Events, filtre por `api.leles.tec.br` para ver qual recurso
  barrou.

**Correção, em ordem de preferência:**

1. **WAF → Custom rules → Create rule**, ação **Skip**:
   ```
   (http.host eq "api.leles.tec.br" and starts_with(http.request.uri.path, "/matriz/"))
   ```
   Marque *All remaining custom rules*, *Rate limiting rules*, *Managed rules*
   e, se o plano tiver, *Super Bot Fight Mode*. O caminho continua protegido
   pela `X-Api-Key`, que a API exige em toda rota de dados.
2. **Plano Free com o Bot Fight Mode ligado:** pelo que sei, esse modo não
   aceita exceção por regra de WAF. Ele vale para a zona inteira. As saídas são:
   - desligar o Bot Fight Mode (Security → Bots);
   - ou apontar a API para um subdomínio próprio em DNS-only (nuvem cinza).
     Isso expõe o IP da VPS nesse nome e muda a URL configurada no Apps Script.

   Se desligar o modo, compense com uma regra de **Rate limiting** em
   `/matriz/` (o Free permite uma).

Não liste IPs do Google numa allowlist. São faixas enormes e mudam.

## 8. Importação dos dados (Fase 4)

1. **Congele o app.** Em cada aparelho, abra o app e toque em "Sincronizar
   agora" até aparecer "Confirmado". Depois disso, não edite mais nada até o
   passo 9.
2. **Baixe o JSON atual** no Drive, em *Matriz de Eisenhower* →
   `matriz.json`, e copie para a VPS:
   ```bash
   $ scp matriz.json <vps>:/tmp/
   ```
3. **Simule e importe:**
   ```bash
   $ docker exec -i matriz-api node scripts/import.ts --dry-run < /tmp/matriz.json
   $ docker exec -i matriz-api node scripts/import.ts < /tmp/matriz.json
   ```
   O relatório mostra a quantidade por entidade no arquivo e no banco, as
   favoritas, a revisão e o checksum dos dois lados. Só siga se aparecer
   `✓ banco idêntico ao arquivo`. Pode repetir a importação quantas vezes
   quiser, porque ela é idempotente.
4. **Apague o arquivo temporário:**
   ```bash
   $ rm /tmp/matriz.json
   ```

## 9. Virada (Fase 5)

No editor do Apps Script de **produção** (projeto "Matriz de Eisenhower"):

1. **Cole o `Code.gs` novo e reimplante** pelo caminho de sempre: Implantar →
   Gerenciar implantações → editar → Nova versão. Com a URL de sempre, o front
   não muda nada. Até aqui, nada mudou para o app, porque sem `MATRIZ_STORAGE`
   o script continua no Drive.
2. **Configure as propriedades:** em Configurações do projeto → Propriedades do
   script, crie `MATRIZ_API_URL` = `https://api.leles.tec.br/matriz` e
   `MATRIZ_API_KEY` = o mesmo valor do `.env`.
3. **Teste a conexão:** rode **`testeVps()`**. O resultado tem que ser `✓ VPS ok
   - API na revisão N`, com N igual à revisão do Drive.
4. **Vire o armazenamento:** rode **`usarApi()`**. Ele:
   - testa a VPS de novo;
   - recusa a virada se a API estiver atrás do Drive (importação esquecida);
   - guarda uma cópia única `matriz.antes-da-api.json` no Drive;
   - só então troca a flag.

   A troca vale na próxima requisição, sem reimplantar.
5. **Confira nos aparelhos:** em cada um, "Sincronizar agora" deve dar
   "Confirmado". Na VPS, o `docker logs -f matriz-api` mostra as requisições
   chegando.

## 10. Rollback

| Situação | No editor do Apps Script | Resultado |
|---|---|---|
| A API está no ar, mas algo está errado | `voltarParaDrive()` | Copia o estado ATUAL da API para o `matriz.json`, com a revisão da API, e volta a flag para `drive`. Nada gravado no período da API se perde. O JSON antigo vira `.bak1` e a cópia `.antes-da-api.json` continua lá. |
| A API ou a VPS caiu | `voltarParaDriveSemCopiar()` | Só volta a flag. O Drive volta ao estado de antes da virada. O que foi gravado no período da API volta pelos próprios aparelhos na próxima sincronização, porque a mesclagem é uma união e cada aparelho reenvia o que tem. |

Em nenhum dos dois casos o front precisa mudar.

**Desligar de vez:**
```bash
$ docker compose stop matriz-api
```
O banco `matriz` fica intocado até você decidir apagá-lo.

## 11. Checklist de teste

- [ ] **Rede da empresa (só `script.google.com`):** abrir o app, criar uma
  tarefa, "Sincronizar agora" mostra "Confirmado". O `docker logs matriz-api`
  mostra `PUT /matriz/v1/state 200 ... rev=N→N+1`.
- [ ] **Celular no 4G:** a tarefa criada no PC aparece. Mover de quadrante, sincronizar e ver a mudança chegar no PC.
- [ ] **Dados antigos migrados:** o relatório da importação teve todas as
  entidades iguais e o mesmo checksum. Conferir no app algumas tarefas antigas,
  o histórico e as anotações.
- [ ] **`favorite` preservado:** favoritar uma tarefa e uma anotação,
  sincronizar e ver a estrela no outro aparelho. Desfavoritar, sincronizar e ver
  a estrela sumir no outro aparelho. No banco:
  ```bash
  $ docker compose exec postgres psql -U matriz_app -d matriz \
      -c "select title, favorite, updated_at, server_updated_at from tasks where favorite is not null"
  ```
- [ ] **`updated_at` a cada edição:** editar o título de uma tarefa,
  sincronizar e rodar a mesma consulta filtrando pelo título. O `updated_at`
  (do aparelho) e o `server_updated_at` (do banco) avançaram, e as tarefas que
  não foram editadas mantêm o `server_updated_at` antigo.
- [ ] **Offline/PWA:** em modo avião, criar uma tarefa. Ela aparece na hora e
  fica pendente. Ao voltar a rede, sincroniza sozinha.
- [ ] **Rollback ensaiado:** depois de confirmar tudo, rodar `voltarParaDrive()`
  e sincronizar. Para voltar à API, reimportar o JSON (passo 8), porque a
  essa altura o Drive já está à frente da API e o `usarApi()` recusa de
  propósito. Depois, rodar `usarApi()` e sincronizar. Nenhuma tarefa some nos
  dois sentidos.
