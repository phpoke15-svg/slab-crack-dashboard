-- Perceptual hash index for fast visual card matching (Collectr-style scanner).
-- Run in Supabase SQL Editor, then backfill with: node scripts/compute-catalog-phash.mjs

alter table public.slab_cards
  add column if not exists phash text;

create index if not exists slab_cards_phash_idx
  on public.slab_cards (phash)
  where phash is not null;

comment on column public.slab_cards.phash is '16-char hex dHash fingerprint for visual scanner matching';
