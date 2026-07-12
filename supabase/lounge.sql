-- Supreme Lounge — Twitter-like collector feed (Supreme-only via app gate).
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Posts (top-level + replies via parent_id)
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  parent_id uuid references public.lounge_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint lounge_posts_body_len check (char_length(trim(body)) between 1 and 280)
);

create index if not exists lounge_posts_created_idx
  on public.lounge_posts (created_at desc);

create index if not exists lounge_posts_author_idx
  on public.lounge_posts (author_id, created_at desc);

create index if not exists lounge_posts_parent_idx
  on public.lounge_posts (parent_id, created_at asc)
  where parent_id is not null;

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_likes (
  post_id uuid not null references public.lounge_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists lounge_likes_user_idx
  on public.lounge_likes (user_id);

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint lounge_follows_no_self check (follower_id <> following_id)
);

create index if not exists lounge_follows_following_idx
  on public.lounge_follows (following_id);

-- ---------------------------------------------------------------------------
-- RLS: service role only (Next.js API enforces Supreme after auth)
-- ---------------------------------------------------------------------------
alter table public.lounge_posts enable row level security;
alter table public.lounge_likes enable row level security;
alter table public.lounge_follows enable row level security;

revoke all on public.lounge_posts from anon, authenticated;
revoke all on public.lounge_likes from anon, authenticated;
revoke all on public.lounge_follows from anon, authenticated;

grant all on public.lounge_posts to service_role;
grant all on public.lounge_likes to service_role;
grant all on public.lounge_follows to service_role;
