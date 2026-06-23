#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
FILENAME="qa_timeoff_${TIMESTAMP}.sql.gz"

echo "[backup] Starting database backup..."

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h postgres \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-acl \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[backup] Backup saved: ${BACKUP_DIR}/${FILENAME}"

# Remove backups older than retention days
find "${BACKUP_DIR}" -name "qa_timeoff_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

echo "[backup] Old backups cleaned (retention: ${RETENTION_DAYS} days)"
echo "[backup] Done"
