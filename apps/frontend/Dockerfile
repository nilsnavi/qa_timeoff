# syntax=docker/dockerfile:1.6

############################
# Stage 1: build
############################
FROM node:20-alpine AS builder
WORKDIR /app

# Workspace manifests first (better layer cache)
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

# Sources
COPY apps/frontend apps/frontend
COPY packages/shared packages/shared

# Vite reads VITE_* env at build time and inlines them.
# Default points at nginx-proxied /api path, override at build time if needed.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build --workspace @qa-timeoff/frontend

############################
# Stage 2: nginx static server
############################
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
