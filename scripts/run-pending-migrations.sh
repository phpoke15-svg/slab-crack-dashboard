#!/usr/bin/env bash
# Run pending Supabase migrations from the multi-card scanner deploy.
# Requires DATABASE_URL (Postgres URI from Supabase → Connect → URI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL. Add it to Cloud Environment secrets or .env.local." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install postgresql-client." >&2
  exit 1
fi

MIGRATIONS=(
  supabase/daily-sales-history.sql
  supabase/notifications.sql
  supabase/scanner-phash.sql
  supabase/scanner-feedback.sql
  supabase/giveaway-draws.sql
)

echo "Running ${#MIGRATIONS[@]} migration files against Supabase..."
for file in "${MIGRATIONS[@]}"; do
  echo "→ $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done

echo ""
echo "Verifying objects..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
select 'slab_sale_events' as object, exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'slab_sale_events'
) as ok
union all
select 'user_notifications', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'user_notifications'
)
union all
select 'slab_cards.phash', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'slab_cards' and column_name = 'phash'
)
union all
select 'scanner_match_feedback', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'scanner_match_feedback'
)
union all
select 'giveaway_draws', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'giveaway_draws'
);
SQL

echo ""
echo "Done. Next: npm run compute-catalog-phash (needs SUPABASE_SERVICE_ROLE_KEY)."
