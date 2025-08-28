# Multi-stage Dockerfile for AI Bug Reproduction Tool
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml turbo.json ./

# Dependencies stage
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS builder
RUN pnpm build

# Runner stage with Python for workers
FROM node:20-alpine AS runner

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

WORKDIR /app

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/pnpm-workspace.yaml ./

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "start"]
