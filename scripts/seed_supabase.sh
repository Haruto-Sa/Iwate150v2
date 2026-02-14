#!/usr/bin/env bash
# Seed Supabase/Postgres with CSVs converted from legacy DB.
# Usage: SUPABASE_DB_URL="postgres://user:pass@host:5432/postgres" ./scripts/seed_supabase.sh
# If SUPABASE_DB_URL is not set, falls back to DATABASE_URL.

set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/supabase/schema.sql"
DATA_DIR="$ROOT/supabase/data"

if [[ -z "$DB_URL" ]]; then
  echo "[seed] Set SUPABASE_DB_URL or DATABASE_URL (postgres connection string) and retry." >&2
  exit 1
fi

if [[ ! -f "$SCHEMA" ]]; then
  echo "[seed] schema.sql not found at $SCHEMA" >&2
  exit 1
fi

echo "[seed] Applying schema..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA"

copy_csv () {
  local table="$1"
  local file="$2"
  local columns="$3"
  echo "[seed] Loading $file into $table..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "\
    TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE; \
    \\copy public.${table} (${columns}) FROM '${file}' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');"
}

copy_csv "cities" "$DATA_DIR/cities.csv" "id,name,name_kana,region,image_path"
copy_csv "genres" "$DATA_DIR/genres.csv" "id,name,image_path"
copy_csv "spots" "$DATA_DIR/spots.csv" "id,name,description,lat,lng,image_path,genre_id,city_id,reference_url"
copy_csv "events" "$DATA_DIR/events.csv" "id,title,location,start_date,end_date,city_id"

echo "[seed] Done."
