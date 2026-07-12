-- Lounge media: photos/videos from device (Supreme Lounge).
-- Run after lounge.sql. Safe to re-run.

-- Allow text-only, media-only, or both (≤280 chars when text present).
alter table public.lounge_posts drop constraint if exists lounge_posts_body_len;
alter table public.lounge_posts
  add constraint lounge_posts_body_len
  check (char_length(trim(body)) <= 280);

create table if not exists public.lounge_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lounge_posts (id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  mime_type text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lounge_media_post_idx
  on public.lounge_media (post_id, sort_order);

alter table public.lounge_media enable row level security;
revoke all on public.lounge_media from anon, authenticated;
grant all on public.lounge_media to service_role;

-- Private bucket; Next.js service role uploads + signed URLs for Supreme feed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lounge-media',
  'lounge-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
