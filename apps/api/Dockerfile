FROM node:20.19-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY openapi.json openapi.json
COPY packages/billing/package.json packages/billing/package.json
COPY packages/billing/bin packages/billing/bin
COPY apps/api/package.json apps/api/package.json
COPY examples/ai-video/package.json examples/ai-video/package.json
RUN pnpm install --frozen-lockfile

COPY packages/billing packages/billing
COPY apps/api apps/api
COPY examples/ai-video examples/ai-video
RUN pnpm build

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
