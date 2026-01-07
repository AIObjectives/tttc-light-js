# Stage 1: Install dependencies and build
FROM node:25-slim AS build

RUN npm install -g pnpm@10

WORKDIR /usr/src/app

# Turbo remote cache credentials (optional - builds work without them)
ARG TURBO_TOKEN
ARG TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM

# Copy workspace config files first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY common/package.json ./common/
COPY pipeline-worker/package.json ./pipeline-worker/

RUN pnpm install --frozen-lockfile

COPY common/ ./common/
COPY pipeline-worker/ ./pipeline-worker/

# Build with Turborepo (uses remote cache if credentials provided)
RUN pnpm turbo run build --filter=pipeline-worker

# Stage 2: Production image
FROM node:25-slim

RUN npm install -g pnpm@10

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
