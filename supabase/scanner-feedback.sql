-- Scanner match feedback (right / wrong) for improving identify accuracy.
-- Run in Supabase SQL Editor. Writes are service-role only via Next.js API.

create extension if not exists pgcrypto;

create table if not exists public.scanner_match_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  correct boolean not null,
  scan_mode text not null check (scan_mode in ('single', 'multi')),
  presented_card_id text,
  card_name text,
  set_name text,
  card_number text,
  match_method text check (match_method is null or match_method in ('visual_phash', 'vision')),
  match_score integer,
  batch_index smallint check (batch_index is null or batch_index between 0 and 8),
  created_at timestamptz not null default now()
);

create index if not exists scanner_match_feedback_created_idx
  on public.scanner_match_feedback (created_at desc);

create index if not exists scanner_match_feedback_correct_idx
  on public.scanner_match_feedback (correct, scan_mode, created_at desc);

create index if not exists scanner_match_feedback_card_idx
  on public.scanner_match_feedback (presented_card_id, created_at desc)
  where presented_card_id is not null;

alter table public.scanner_match_feedback enable row level security;

revoke all on public.scanner_match_feedback from anon, authenticated;
grant all on public.scanner_match_feedback to service_role;

comment on table public.scanner_match_feedback is 'User right/wrong signals on scanner catalog matches';
