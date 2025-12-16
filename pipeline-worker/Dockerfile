# Stage 1: Install dependencies and build
FROM node:24-slim AS build

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /usr/src/app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY pipeline-worker/package.json ./pipeline-worker/

RUN pnpm install --frozen-lockfile

COPY common/ ./common/
COPY pipeline-worker/ ./pipeline-worker/

RUN pnpm --filter=tttc-common run build
RUN pnpm --filter=pipeline-worker run build

# Stage 2: Production image
FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /usr/src/app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY pipeline-worker/package.json ./pipeline-worker/

# Install production dependencies only (--ignore-scripts prevents husky from running)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /usr/src/app/pipeline-worker/dist ./pipeline-worker/dist
COPY --from=build /usr/src/app/common/dist ./common/dist

WORKDIR /usr/src/app/pipeline-worker

ENV NODE_ENV=production

RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["pnpm", "run", "start"]
