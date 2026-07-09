-- User blocks and reports (safe to re-run)
-- Also included in supabase/pokematch-setup.sql

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view own blocks" on public.user_blocks;
drop policy if exists "Users can create own blocks" on public.user_blocks;
drop policy if exists "Users can delete own blocks" on public.user_blocks;

create policy "Users can view own blocks"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocker_id);

create policy "Users can create own blocks"
  on public.user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id);

create policy "Users can delete own blocks"
  on public.user_blocks for delete to authenticated
  using (auth.uid() = blocker_id);

-- Users can see if they were blocked by someone (needed to hide profiles in app logic via API)
drop policy if exists "Users can see blocks targeting them" on public.user_blocks;
create policy "Users can see blocks targeting them"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocked_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'fraud', 'inappropriate', 'other')),
  details text not null default '',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index if not exists user_reports_reported_idx on public.user_reports (reported_id, created_at desc);
create index if not exists user_reports_reporter_idx on public.user_reports (reporter_id, created_at desc);

alter table public.user_reports enable row level security;

drop policy if exists "Users can create reports" on public.user_reports;
drop policy if exists "Users can view own reports" on public.user_reports;

create policy "Users can create reports"
  on public.user_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.user_reports for select to authenticated
  using (auth.uid() = reporter_id);

grant all on public.user_blocks to service_role;
grant all on public.user_reports to service_role;

-- Refresh binder visibility to respect blocks (re-run after tables exist)
create or replace function public.can_view_binder(owner_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare vis text;
begin
  if auth.uid() = owner_id then return true; end if;
  if auth.uid() is null then return false; end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
       or (b.blocker_id = owner_id and b.blocked_id = auth.uid())
  ) then
    return false;
  end if;

  select binder_visibility into vis from public.profiles where id = owner_id;
  if vis is null or vis = 'public' then return true; end if;
  if vis = 'private' then return false; end if;
  return exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = owner_id)
        or (f.requester_id = owner_id and f.addressee_id = auth.uid())
      )
  );
end;
$$;
