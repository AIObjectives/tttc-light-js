# syntax=docker.io/docker/dockerfile:1
FROM node:24-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY next-client/package.json ./next-client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/common/node_modules ./common/node_modules
COPY --from=deps /app/next-client/node_modules ./next-client/node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy source code
COPY common/ ./common/
COPY next-client/ ./next-client/

# Build
RUN pnpm --filter=tttc-common run build
RUN pnpm --filter=next-client run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/next-client/public ./next-client/public
COPY --from=builder --chown=nextjs:nodejs /app/next-client/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/static ./next-client/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/common/dist ./node_modules/tttc-common/dist
COPY --from=builder --chown=nextjs:nodejs /app/common/package.json ./node_modules/tttc-common/

HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000
USER nextjs

WORKDIR /app/next-client
CMD ["node", "server.js"]
