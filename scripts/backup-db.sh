#!/usr/bin/env bash
# =============================================================================
# QA TimeOff — Database Backup Script
# =============================================================================
# Description:
#   Creates a PostgreSQL dump from the qa-timeoff-postgres container,
#   compresses it with gzip, and stores it locally. Old backups older than
#   30 days are automatically removed.
#
# Prerequisites:
#   - Docker and docker compose must be installed
#   - The qa-timeoff-postgres container must be running
#   - The project must be deployed via docker-compose.yml
#
# Usage:
#   ./scripts/backup-db.sh                    # uses defaults
#   BACKUP_DIR=/custom/path ./scripts/backup-db.sh
#   RETENTION_DAYS=60 ./scripts/backup-db.sh
# =============================================================================

set -euo pipefail

# ---- Configuration ---------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/qa_timeoff}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
CONTAINER_NAME="qa-timeoff-postgres"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
FILENAME="qa_timeoff_${TIMESTAMP}.sql.gz"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ---- Functions -------------------------------------------------------------
info()  { echo "[backup] $*"; }
error() { echo "[backup] ERROR: $*" >&2; exit 1; }

# ---- Checks ----------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    error "Docker is not installed."
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Try docker compose as fallback
    if [ -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
        info "Container '${CONTAINER_NAME}' not running. Attempting to start stack…"
        docker compose -f "${COMPOSE_DIR}/docker-compose.yml" up -d postgres 2>/dev/null || true
        # Wait for container to be healthy
        for i in $(seq 1 10); do
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                break
            fi
            sleep 2
        done
    fi
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        error "Container '${CONTAINER_NAME}' is not running. Start the stack first:\n  cd ${COMPOSE_DIR} && docker compose up -d"
    fi
fi

# ---- Create backup directory -----------------------------------------------
mkdir -p "${BACKUP_DIR}"

# ---- Dump ------------------------------------------------------------------
info "Starting PostgreSQL dump from container '${CONTAINER_NAME}'…"
info "Target: ${BACKUP_DIR}/${FILENAME}"

# Use docker exec to run pg_dump inside the container.
# --no-owner / --no-acl so the dump is portable across environments.
docker exec "${CONTAINER_NAME}" \
    pg_dump \
        -U "${POSTGRES_USER:-qa_timeoff}" \
        -d "${POSTGRES_DB:-qa_timeoff}" \
        --no-owner \
        --no-acl \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verify the dump is valid
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
    error "Backup file is empty — something went wrong."
fi

info "Backup saved: ${BACKUP_DIR}/${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# ---- Cleanup old backups ---------------------------------------------------
info "Removing backups older than ${RETENTION_DAYS} days…"

find "${BACKUP_DIR}" \
    -maxdepth 1 \
    -name "qa_timeoff_*.sql.gz" \
    -type f \
    -mtime "+${RETENTION_DAYS}" \
    -delete 2>/dev/null || true

# Also report how many backups remain
REMAINING=$(find "${BACKUP_DIR}" -maxdepth 1 -name "qa_timeoff_*.sql.gz" -type f | wc -l)
info "Cleanup done. ${REMAINING} backup(s) remaining."

# ---- Done ------------------------------------------------------------------
info "Backup completed successfully."
