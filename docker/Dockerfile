# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/core-server/package.json ./packages/core-server/
COPY packages/core-client/package.json ./packages/core-client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build all packages
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files for production install
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy built packages
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/node_modules/.prisma ./packages/db/node_modules/.prisma

COPY --from=builder /app/packages/core-server/dist ./packages/core-server/dist
COPY --from=builder /app/packages/core-server/package.json ./packages/core-server/

# Copy frontend build for static serving
COPY --from=builder /app/packages/core-client/dist ./packages/core-client/dist
COPY --from=builder /app/packages/core-client/package.json ./packages/core-client/

# Copy config directory
COPY --from=builder /app/config ./config

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma client for production
RUN cd packages/db && npx prisma generate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Set production environment
ENV NODE_ENV=production

# Start server
CMD ["node", "packages/core-server/dist/index.js"]
