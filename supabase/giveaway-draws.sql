-- Optional: log monthly draw results (run after giveaway.sql).
create table if not exists public.giveaway_draws (
  id uuid primary key default gen_random_uuid(),
  month_period text not null unique check (month_period ~ '^\d{4}-\d{2}$'),
  winner_user_id uuid references public.profiles (id) on delete set null,
  total_entries integer not null default 0,
  unique_entrants integer not null default 0,
  drawn_at timestamptz not null default now()
);

alter table public.giveaway_draws enable row level security;
revoke all on public.giveaway_draws from anon, authenticated;
grant all on public.giveaway_draws to service_role;
