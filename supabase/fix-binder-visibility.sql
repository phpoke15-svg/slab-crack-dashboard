-- Run this if friends' binders / matches return empty but cards exist.
-- Requires pokematch.sql to have been run first (profiles + friendships tables).

-- Cross-user binder visibility (safe to re-run)
create or replace function public.can_view_binder(owner_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  vis text;
begin
  if auth.uid() = owner_id then return true; end if;
  if auth.uid() is null then return false; end if;

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

drop policy if exists "Users can view visible binders" on public.user_binders;

create policy "Users can view visible binders"
  on public.user_binders for select
  to authenticated
  using (public.can_view_binder(user_id));

create index if not exists user_binders_card_status_idx
  on public.user_binders (card_id, status);
create index if not exists user_binders_user_status_idx
  on public.user_binders (user_id, status);
