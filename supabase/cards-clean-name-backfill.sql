-- Backfill clean_name for prefix search (run after cards-scrydex-webhook.sql)
-- Matches normalizeSearchCleanName() in lib/db/catalog-search-local.ts

update public.cards
set clean_name = trim(
  regexp_replace(
    regexp_replace(lower(name), '[^a-z0-9\s]', ' ', 'g'),
    '\s+',
    ' ',
    'g'
  )
)
where clean_name is null
  and name is not null;
