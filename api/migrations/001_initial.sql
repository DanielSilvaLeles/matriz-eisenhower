-- Schema inicial da API da Matriz (migração do matriz.json do Drive para o
-- PostgreSQL). Ver api/README.md para o desenho completo.
--
-- Colunas de DOMÍNIO (id, title, ..., created_at, updated_at) guardam
-- exatamente o que o front mandou: `updated_at` do domínio é do cliente
-- de propósito - a mesclagem "vence o updated_at mais recente" e o checksum
-- de verificação dependem dele (CLAUDE.md, "Sincronização").
--
-- Colunas `server_created_at`/`server_updated_at` são do BANCO: mantidas por
-- default/trigger, nunca vêm do cliente, nunca vão na resposta. Dão a toda
-- entidade um registro confiável de quando o servidor viu a linha nascer e
-- mudar de verdade (o upsert do push só toca uma linha que mudou).
--
-- `extra jsonb`: chaves que o front mande e que ainda não têm coluna própria
-- (ex.: um campo opcional novo, como `favorite` foi). Sem isso, a API
-- descartaria o campo, o checksum relido não bateria e o sync nunca mais
-- confirmaria - o Code.gs guardava qualquer chave, a API precisa continuar
-- guardando.
--
-- Sem chave estrangeira entre entidades, de propósito: o sync é uma união
-- eventual - uma tarefa/anotação pode ser apagada de vez (limpeza de
-- tombstone de 30 dias) com eventos/tarefas ainda apontando para ela, e o
-- arquivo JSON sempre aceitou isso.

CREATE FUNCTION touch_server_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.server_updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uma linha só: a revisão do documento (antes no envelope do matriz.json).
CREATE TABLE sync_state (
  id                smallint PRIMARY KEY CHECK (id = 1),
  revision          integer NOT NULL CHECK (revision >= 0),
  checksum          text,
  schema_version    integer NOT NULL,
  server_created_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sync_state (id, revision, checksum, schema_version) VALUES (1, 0, NULL, 2);

CREATE TABLE tasks (
  id                 uuid PRIMARY KEY,
  title              text NOT NULL,
  notes              text,
  quadrant           text CHECK (quadrant IN ('q1', 'q2', 'q3', 'q4')),
  status             text NOT NULL CHECK (status IN ('open', 'done', 'archived')),
  position           double precision NOT NULL,
  date               date,
  delegated_to       text,
  delegation_context text,
  expected_outcome   text,
  tags               text[] NOT NULL DEFAULT '{}',
  source             text NOT NULL CHECK (source IN ('web', 'pwa', 'share', 'note')),
  context            text NOT NULL CHECK (context IN ('work', 'personal')),
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  completed_at       timestamptz,
  deleted            boolean NOT NULL,
  device             text NOT NULL,
  source_note_id     uuid,
  -- NULL = chave ausente no JSON (nunca favoritada); false = desmarcada.
  -- Os dois são diferentes para o checksum - nunca normalizar um no outro.
  favorite           boolean,
  extra              jsonb NOT NULL DEFAULT '{}',
  server_created_at  timestamptz NOT NULL DEFAULT now(),
  server_updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_source_note_id_idx ON tasks (source_note_id) WHERE source_note_id IS NOT NULL;

CREATE TABLE task_events (
  id                uuid PRIMARY KEY,
  task_id           uuid NOT NULL,
  type              text NOT NULL CHECK (type IN ('created', 'moved', 'completed', 'reopened', 'archived')),
  from_quadrant     text CHECK (from_quadrant IN ('q1', 'q2', 'q3', 'q4')),
  to_quadrant       text CHECK (to_quadrant IN ('q1', 'q2', 'q3', 'q4')),
  at                timestamptz NOT NULL,
  device            text NOT NULL,
  extra             jsonb NOT NULL DEFAULT '{}',
  server_created_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_events_task_id_idx ON task_events (task_id);

CREATE TABLE people (
  id                uuid PRIMARY KEY,
  name              text NOT NULL,
  updated_at        timestamptz NOT NULL,
  extra             jsonb NOT NULL DEFAULT '{}',
  server_created_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id                uuid PRIMARY KEY,
  title             text,
  body              text NOT NULL,
  tags              text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL,
  deleted           boolean NOT NULL,
  deleted_at        timestamptz,
  device            text NOT NULL,
  favorite          boolean,
  extra             jsonb NOT NULL DEFAULT '{}',
  server_created_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

-- Equivalente ao rodízio matriz.bak1.json/bak2.json: as duas últimas
-- versões do documento antes de cada push (a API mantém só 2).
CREATE TABLE sync_snapshots (
  revision          integer PRIMARY KEY,
  checksum          text,
  data              jsonb NOT NULL,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sync_state_touch BEFORE UPDATE ON sync_state
  FOR EACH ROW EXECUTE FUNCTION touch_server_updated_at();
CREATE TRIGGER tasks_touch BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION touch_server_updated_at();
CREATE TRIGGER task_events_touch BEFORE UPDATE ON task_events
  FOR EACH ROW EXECUTE FUNCTION touch_server_updated_at();
CREATE TRIGGER people_touch BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION touch_server_updated_at();
CREATE TRIGGER notes_touch BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION touch_server_updated_at();
