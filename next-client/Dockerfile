# syntax=docker.io/docker/dockerfile:1
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Add libc6-compat for Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for both common and next-client
COPY common/package*.json ./common/
COPY next-client/package*.json ./next-client/

# Install dependencies for common first since it's a dependency
RUN npm ci --prefix ./common --frozen-lockfile
# Install dependencies for next-client
RUN npm ci --prefix ./next-client --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/common/node_modules ./common/node_modules
COPY --from=deps /app/next-client/node_modules ./next-client/node_modules

# Copy source code
COPY common/ ./common/
COPY next-client/ ./next-client/

# Build common first
RUN npm run build --prefix ./common
# Then build next-client with standalone output
RUN npm run build --prefix ./next-client

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy next-client files
COPY --from=builder --chown=nextjs:nodejs /app/next-client/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next-client/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/next-client/.next/static ./.next/static

# Copy common package to node_modules to make it available as a dependency
COPY --from=builder --chown=nextjs:nodejs /app/common ./node_modules/tttc-common

# Add healthcheck
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

USER nextjs

# Use server.js that's created by Next.js in standalone mode
CMD ["node", "server.js"]