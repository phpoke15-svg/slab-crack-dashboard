-- Tighten friend request RLS so only pending requests can be created
-- and only the recipient can accept (not the requester).

alter table public.friendships drop constraint if exists friendships_status_check;
alter table public.friendships
  add constraint friendships_status_check
  check (status in ('pending', 'accepted'));

drop policy if exists "Users can create friend requests" on public.friendships;
create policy "Users can create friend requests"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "Users can update friendships they are part of" on public.friendships;
drop policy if exists "Addressee can accept pending requests" on public.friendships;

create policy "Addressee can accept pending requests"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id and status = 'pending')
  with check (status = 'accepted');
