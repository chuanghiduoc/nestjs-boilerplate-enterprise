# ==============================================
# Multi-stage Dockerfile for NestJS Application
# Section 12.8: Deployment Strategy
# ==============================================

# ----------------------------------------------
# Stage 1: Dependencies
# ----------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Prisma's client is generated during install (postinstall) and needs openssl.
RUN apk add --no-cache openssl

# Install dependencies only (for caching).
# The Prisma schema must be present so "prisma generate" (postinstall) succeeds.
COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile --production=false

# ----------------------------------------------
# Stage 2: Builder
# ----------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# openssl is required when "prisma generate" re-runs during the production install.
RUN apk add --no-cache openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (also copies runtime assets into dist via nest-cli)
RUN yarn build

# Remove dev dependencies
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

# ----------------------------------------------
# Stage 3: Production Runner
# ----------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# openssl is required by Prisma's query engine at runtime (DB_ORM=prisma).
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application.
# Runtime assets (i18n translations, email templates) are bundled into dist
# by nest-cli, so no separate copy of the src tree is required.
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Writable directory for the local storage driver (STORAGE_DRIVER=local).
# Owned by the non-root runtime user so uploads succeed out of the box.
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads

# Health check
# Use 127.0.0.1 (not localhost): in the container localhost may resolve to IPv6
# (::1) while the server binds to 0.0.0.0 (IPv4), which would refuse the probe.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/v1/health/live || exit 1

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main.js"]
