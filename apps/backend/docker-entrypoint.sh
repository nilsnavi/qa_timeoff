#!/bin/sh
set -e

echo "[entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma

if [ "${RUN_SEED}" = "true" ]; then
  echo "[entrypoint] Running database seed..."
  node apps/backend/dist/prisma/seed.js || echo "[entrypoint] Seed failed or already applied, continuing..."
fi

echo "[entrypoint] Starting NestJS application..."
exec node apps/backend/dist/src/main.js
