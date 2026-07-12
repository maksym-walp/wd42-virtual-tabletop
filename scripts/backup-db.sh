#!/usr/bin/env bash
# Dumps the walp-postgres database to backups/, gzip-compressed, timestamped.
# Deletes backups older than RETENTION_DAYS (default 14). Intended for cron.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
CONTAINER="${POSTGRES_CONTAINER:-walp-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER not set (check .env)}"
: "${POSTGRES_DB:?POSTGRES_DB not set (check .env)}"

if ! docker exec "$CONTAINER" true >/dev/null 2>&1; then
  echo "Error: container '$CONTAINER' is not running." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y-%m-%d_%H%M)"
out_file="$BACKUP_DIR/walp_${timestamp}.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$out_file"
echo "Backup written to $out_file"

find "$BACKUP_DIR" -name 'walp_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "Removed backups older than ${RETENTION_DAYS} days."
