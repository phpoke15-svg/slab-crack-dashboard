-- Discovery cron cursor for TCGGO catalog pagination (safe to re-run).

create table if not exists public.discovery_scan_state (
  job_id text primary key,
  catalog_page integer not null default 1 check (catalog_page >= 1),
  total_pages integer,
  updated_at timestamptz not null default now()
);

alter table public.discovery_scan_state enable row level security;

grant select on public.discovery_scan_state to authenticated;
grant all on public.discovery_scan_state to service_role;

drop policy if exists "discovery_scan_state_read" on public.discovery_scan_state;
create policy "discovery_scan_state_read"
  on public.discovery_scan_state for select
  to authenticated
  using (true);
