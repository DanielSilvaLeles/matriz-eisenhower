-- Banco e usuário dedicados da Matriz. Rode como superusuário do Postgres:
--
--   SENHA=$(openssl rand -hex 24)        # guarde: vai no MATRIZ_DATABASE_URL do .env
--   docker compose exec -T postgres psql -U <superusuario> -v senha="$SENHA" \
--     < matriz-eisenhower/api/deploy/create-database.sql
--
-- Não toca em nenhum outro banco ou usuário existente.

CREATE ROLE matriz_app LOGIN PASSWORD :'senha';
CREATE DATABASE matriz OWNER matriz_app ENCODING 'UTF8' TEMPLATE template0;

-- Nenhum outro usuário do servidor conecta neste banco.
REVOKE ALL ON DATABASE matriz FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE matriz TO matriz_app;

\connect matriz
-- As migrations (api/migrations) criam as tabelas como dono do schema.
ALTER SCHEMA public OWNER TO matriz_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
