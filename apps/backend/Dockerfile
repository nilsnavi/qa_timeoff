# syntax=docker/dockerfile:1.6

############################
# Stage 1: build
############################
FROM node:20-alpine AS builder
WORKDIR /app

# Install all workspace manifests first to leverage layer cache
COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json

# Reproducible install across the monorepo
RUN npm ci

# Bring in the actual sources
COPY apps/backend apps/backend
COPY packages/shared packages/shared

# Generate Prisma client and compile NestJS
RUN npm run prisma:generate --workspace @qa-timeoff/backend \
    && npm run build --workspace @qa-timeoff/backend

############################
# Stage 2: runtime
############################
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Tools needed by the entrypoint (sh + openssl is required by Prisma engines)
RUN apk add --no-cache bash openssl

# Copy the whole node_modules from builder so Prisma CLI (devDep) is available
# for "prisma migrate deploy" at startup. This keeps the image self-contained
# and avoids a second npm install round-trip.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules apps/backend/node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# App workspaces (only what we need at runtime)
COPY --from=builder /app/apps/backend/package.json apps/backend/package.json
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
COPY --from=builder /app/packages/shared packages/shared

COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
