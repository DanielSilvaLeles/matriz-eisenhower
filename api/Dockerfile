# API da Matriz - Node roda os .ts direto (type stripping nativo), sem build.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

USER node
EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-5002}${BASE_PATH:-/matriz}/health" >/dev/null || exit 1

CMD ["node", "src/server.ts"]
