# Stage 1: Install dependencies and build
FROM node:24-slim AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /usr/src/app

# Turbo remote cache credentials (optional - builds work without them)
ARG TURBO_TOKEN
ARG TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM

# Copy workspace config files first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY common/package.json ./common/
COPY express-server/package.json ./express-server/

# Install all dependencies (pnpm handles workspace linking)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY common/ ./common/
COPY express-server/ ./express-server/

# Build with Turborepo (uses remote cache if credentials provided)
RUN pnpm turbo run build --filter=express-server

# Stage 2: Production image
FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /usr/src/app

# Copy workspace config for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY express-server/package.json ./express-server/

# Install production dependencies only (--ignore-scripts prevents husky from running)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts
COPY --from=build /usr/src/app/express-server/dist ./express-server/dist
COPY --from=build /usr/src/app/common/dist ./common/dist

WORKDIR /usr/src/app/express-server

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK CMD curl --fail http://localhost:8080/ || exit 1

RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["pnpm", "run", "start"]
