# syntax=docker/dockerfile:1.7

FROM node:24.20-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/billing/package.json packages/billing/package.json
COPY packages/billing/bin packages/billing/bin
COPY apps/api/package.json apps/api/package.json
COPY examples/ai-video/package.json examples/ai-video/package.json
RUN pnpm install --frozen-lockfile

COPY openapi.json openapi.json
COPY packages/billing packages/billing
COPY apps/api apps/api
RUN pnpm --filter @velobase/billing build \
  && pnpm --filter @velobase/api build \
  && pnpm --filter @velobase/api --prod deploy --legacy /opt/velobase-api

FROM node:24.20-alpine AS runtime

ARG VERSION=dev
ARG REVISION=unknown

ENV HOST="0.0.0.0"
ENV NODE_ENV="production"
ENV PORT="3000"

LABEL org.opencontainers.image.title="Velobase" \
  org.opencontainers.image.description="Open-source usage credit engine for AI and SaaS products" \
  org.opencontainers.image.source="https://github.com/velobase/velobase" \
  org.opencontainers.image.documentation="https://github.com/velobase/velobase#readme" \
  org.opencontainers.image.licenses="Apache-2.0" \
  org.opencontainers.image.version="$VERSION" \
  org.opencontainers.image.revision="$REVISION"

WORKDIR /app

RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-* \
  && rm -f /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg

COPY --from=build --chown=node:node /opt/velobase-api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /opt/velobase-api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/openapi.json ./openapi.json
COPY --chown=node:node LICENSE NOTICE /licenses/velobase/
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/velobase

USER 1000:1000

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["velobase"]
CMD ["server"]
