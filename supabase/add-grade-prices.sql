-- Run in Supabase SQL Editor if slab_anomalies already exists without grade_prices.
alter table public.slab_anomalies
  add column if not exists grade_prices jsonb;
