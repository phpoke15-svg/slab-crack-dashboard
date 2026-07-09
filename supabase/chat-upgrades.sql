-- Chat upgrades: photo messages + Supabase Storage + Realtime
-- Run in Supabase SQL editor after trade-messages.sql

-- ─── Message schema: images + captions ───────────────────────────────────────

alter table public.trade_messages
  add column if not exists image_url text not null default '';

alter table public.trade_messages drop constraint if exists trade_messages_message_type_check;
alter table public.trade_messages add constraint trade_messages_message_type_check
  check (message_type in ('text', 'proposal', 'counter', 'status', 'image'));

-- ─── Realtime (live message delivery) ────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.trade_messages;
exception
  when duplicate_object then null;
end $$;

-- ─── Storage bucket for condition photos ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trade participants can upload chat images" on storage.objects;
drop policy if exists "Trade participants can read chat images" on storage.objects;
drop policy if exists "Trade participants can delete own chat images" on storage.objects;

create policy "Trade participants can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can read chat images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can delete own chat images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
