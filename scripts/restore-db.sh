#!/usr/bin/env bash
# =============================================================================
# QA TimeOff — Database Restore Script
# =============================================================================
# Description:
#   Restores a PostgreSQL dump from a previously created backup file into the
#   qa-timeoff-postgres container. The script is intentionally cautious:
#   it asks for confirmation, creates a safety backup first, and rejects
#   unknown backup files.
#
# Prerequisites:
#   - Docker must be installed
#   - The qa-timeoff-postgres container must be running
#   - A backup file from scripts/backup-db.sh
#
# Usage:
#   ./scripts/restore-db.sh                          # interactive mode — lists available backups
#   BACKUP_FILE=/path/to/dump.sql.gz ./scripts/restore-db.sh   # restore specific file
#   FORCE=1 ./scripts/restore-db.sh                  # skip confirmation prompts (CI/emergency)
# =============================================================================

set -euo pipefail

# ---- Configuration ---------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/qa_timeoff}"
CONTAINER_NAME="qa-timeoff-postgres"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ---- Colors for interactive output -----------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ---- Functions -------------------------------------------------------------
info()    { echo -e "${GREEN}[restore]${NC} $*"; }
warn()    { echo -e "${YELLOW}[restore] WARNING:${NC} $*" >&2; }
error()   { echo -e "${RED}[restore] ERROR:${NC} $*" >&2; exit 1; }
heading() { echo -e "\n${CYAN}━━━ $* ━━━${NC}\n"; }

confirm() {
    if [ "${FORCE:-0}" = "1" ]; then
        return 0
    fi
    local prompt="$1"
    local default="${2:-n}"
    local yn
    read -r -p "$(echo -e "${YELLOW}${prompt} (y/N):${NC} ")" yn
    case "${yn:-$default}" in
        [yY]|[yY][eE][sS]) return 0 ;;
        *) return 1 ;;
    esac
}

# ---- Checks ----------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    error "Docker is not installed."
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "Container '${CONTAINER_NAME}' is not running.\nStart the stack: cd ${COMPOSE_DIR} && docker compose up -d"
fi

# ---- Determine backup file -------------------------------------------------
if [ -n "${BACKUP_FILE:-}" ]; then
    RESTORE_FILE="${BACKUP_FILE}"
else
    # List available backups
    heading "Available backups"

    if [ ! -d "${BACKUP_DIR}" ]; then
        error "Backup directory '${BACKUP_DIR}' does not exist.\nCreate a backup first: sudo ./scripts/backup-db.sh"
    fi

    mapfile -t backups < <(find "${BACKUP_DIR}" -maxdepth 1 -name "qa_timeoff_*.sql.gz" -type f | sort -r)

    if [ ${#backups[@]} -eq 0 ]; then
        error "No backup files found in '${BACKUP_DIR}'.\nCreate a backup first: sudo ./scripts/backup-db.sh"
    fi

    echo "  #  | Date                    | Size      | File"
    echo "  ---+-------------------------+-----------+----------------------------------------"
    for i in "${!backups[@]}"; do
        size=$(du -h "${backups[$i]}" | cut -f1)
        fname=$(basename "${backups[$i]}")
        printf "  %-2s | %-23s | %-9s | %s\n" "$((i+1))" "$(date -r "${backups[$i]}" "+%Y-%m-%d %H:%M:%S")" "${size}" "${fname}"
    done
    echo ""

    read -r -p "$(echo -e "${CYAN}Enter backup number to restore (1-${#backups[@]}) or 'q' to quit:${NC} ")" choice

    if [ "${choice,,}" = "q" ]; then
        info "Restore cancelled."
        exit 0
    fi

    if ! [[ "${choice}" =~ ^[0-9]+$ ]] || [ "${choice}" -lt 1 ] || [ "${choice}" -gt "${#backups[@]}" ]; then
        error "Invalid choice. Enter a number between 1 and ${#backups[@]}."
    fi

    RESTORE_FILE="${backups[$((choice-1))]}"
fi

if [ ! -f "${RESTORE_FILE}" ]; then
    error "Backup file not found: ${RESTORE_FILE}"
fi

RESTORE_BASENAME=$(basename "${RESTORE_FILE}")

# ---- Confirm ---------------------------------------------------------------
heading "Restore plan"
echo "  Container:  ${CONTAINER_NAME}"
echo "  Backup:     ${RESTORE_FILE}"
echo "  Database:   ${POSTGRES_DB:-qa_timeoff}"
echo ""
warn "This will REPLACE the current database with data from the backup!"
echo ""

if ! confirm "Are you sure you want to proceed?"; then
    info "Restore cancelled."
    exit 0
fi

# ---- Safety backup ---------------------------------------------------------
heading "Creating safety backup"
SAFE_BACKUP_FILE="${BACKUP_DIR}/__pre_restore_$(date +"%Y-%m-%d_%H-%M-%S").sql.gz"
info "Creating a safety backup before restore…"

docker exec "${CONTAINER_NAME}" \
    pg_dump \
        -U "${POSTGRES_USER:-qa_timeoff}" \
        -d "${POSTGRES_DB:-qa_timeoff}" \
        --no-owner \
        --no-acl \
    | gzip > "${SAFE_BACKUP_FILE}"

if [ ! -s "${SAFE_BACKUP_FILE}" ]; then
    error "Safety backup failed — aborting restore."
fi

info "Safety backup saved: ${SAFE_BACKUP_FILE}"
echo ""

# ---- Restore ---------------------------------------------------------------
heading "Restoring from backup"
info "Dropping and recreating the database…"

# Terminate existing connections and drop/recreate the database
docker exec -i "${CONTAINER_NAME}" \
    psql -U "${POSTGRES_USER:-qa_timeoff}" -d postgres <<EOSQL
    UPDATE pg_database SET datallowconn = 'false' WHERE datname = '${POSTGRES_DB:-qa_timeoff}';
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB:-qa_timeoff}';
    DROP DATABASE IF EXISTS "${POSTGRES_DB:-qa_timeoff}";
    CREATE DATABASE "${POSTGRES_DB:-qa_timeoff}" OWNER "${POSTGRES_USER:-qa_timeoff}";
EOSQL

info "Restoring data from '${RESTORE_BASENAME}'…"
gunzip -c "${RESTORE_FILE}" | docker exec -i "${CONTAINER_NAME}" \
    psql \
        -U "${POSTGRES_USER:-qa_timeoff}" \
        -d "${POSTGRES_DB:-qa_timeoff}" \
        --set ON_ERROR_STOP=on

info "Restore completed successfully."

# ---- Verify ----------------------------------------------------------------
heading "Verification"
docker exec "${CONTAINER_NAME}" \
    psql \
        -U "${POSTGRES_USER:-qa_timeoff}" \
        -d "${POSTGRES_DB:-qa_timeoff}" \
        -c "SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';"

echo ""
info "The database has been restored from: ${RESTORE_FILE}"
info "A safety backup of the previous state is at: ${SAFE_BACKUP_FILE}"
echo ""
warn "If the application (backend) was running, restart it:"
echo "  sudo docker compose restart backend"
