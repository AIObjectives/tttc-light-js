# syntax=docker.io/docker/dockerfile:1
FROM node:25-slim AS base

RUN npm install -g pnpm@10

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY common/package.json ./common/
COPY next-client/package.json ./next-client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Turbo remote cache credentials (optional - builds work without them)
ARG TURBO_TOKEN
ARG TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN
ENV TURBO_TEAM=$TURBO_TEAM

# Copy from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/common/node_modules ./common/node_modules
COPY --from=deps /app/next-client/node_modules ./next-client/node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./
COPY --from=deps /app/turbo.json ./

# Copy source code
COPY common/ ./common/
COPY next-client/ ./next-client/

# Build with Turborepo (uses remote cache if credentials provided)
RUN pnpm turbo run build --filter=next-client

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/next-client/public ./next-client/public
COPY --from=builder --chown=nextjs:nodejs /app/next-client/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/static ./next-client/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/common/dist ./node_modules/tttc-common/dist
COPY --from=builder --chown=nextjs:nodejs /app/common/package.json ./node_modules/tttc-common/

HEALTHCHECK CMD curl --fail http://localhost:3000/ || exit 1

EXPOSE 3000
USER nextjs

WORKDIR /app/next-client
CMD ["node", "server.js"]
