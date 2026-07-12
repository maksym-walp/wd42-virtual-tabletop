#!/usr/bin/env bash
# Applies database/migrations/*.sql to the running walp-postgres container,
# tracking already-applied files in a schema_migrations table so re-runs are safe.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
CONTAINER="${POSTGRES_CONTAINER:-walp-postgres}"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER not set (check .env)}"
: "${POSTGRES_DB:?POSTGRES_DB not set (check .env)}"

if ! docker exec "$CONTAINER" true >/dev/null 2>&1; then
  echo "Error: container '$CONTAINER' is not running. Start the stack first." >&2
  exit 1
fi

psql() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

psql -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);" >/dev/null

applied_count=0
skipped_count=0

for file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort); do
  name="$(basename "$file")"
  already_applied="$(psql -tA -c "SELECT 1 FROM public.schema_migrations WHERE filename = '$name';")"
  if [ "$already_applied" = "1" ]; then
    skipped_count=$((skipped_count + 1))
    continue
  fi
  echo "Applying $name..."
  psql < "$file"
  psql -c "INSERT INTO public.schema_migrations (filename) VALUES ('$name');" >/dev/null
  applied_count=$((applied_count + 1))
done

echo "Done. Applied: $applied_count, already up to date: $skipped_count."
