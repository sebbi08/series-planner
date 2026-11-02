# syntax=docker/dockerfile:1
# Build once on the runner's native platform; .output is plain JS, so it runs on every target platform.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine
ARG APP_VERSION=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/sebbi08/series-planner"
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
# CLI: lives next to .output/server/node_modules so `mongodb` resolves
COPY --from=build --chown=node:node /app/lib ./.output/server/lib
COPY --from=build --chown=node:node /app/scripts/create-user.mjs ./.output/server/scripts/create-user.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
