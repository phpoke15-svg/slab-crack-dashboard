-- Product Feedback + roadmap voting.
-- Any signed-in user can submit feedback and vote on ideas.
-- Reading feedback inbox is Supreme-only via the Next.js API (service role).
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Feedback messages (user → Supreme inbox)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint feedback_messages_body_len check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists feedback_messages_created_idx
  on public.feedback_messages (created_at desc);

create index if not exists feedback_messages_author_idx
  on public.feedback_messages (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Potential tools / roadmap ideas
-- ---------------------------------------------------------------------------
create table if not exists public.roadmap_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roadmap_ideas_title_len check (char_length(trim(title)) between 1 and 120),
  constraint roadmap_ideas_description_len check (char_length(trim(description)) <= 1000)
);

create index if not exists roadmap_ideas_active_score_idx
  on public.roadmap_ideas (active, created_at desc);

-- ---------------------------------------------------------------------------
-- Votes: +1 upvote / -1 downvote (one vote per user per idea)
-- ---------------------------------------------------------------------------
create table if not exists public.roadmap_votes (
  idea_id uuid not null references public.roadmap_ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists roadmap_votes_user_idx
  on public.roadmap_votes (user_id);

create index if not exists roadmap_votes_idea_idx
  on public.roadmap_votes (idea_id);

-- ---------------------------------------------------------------------------
-- RLS: service role only (API enforces auth + Supreme for inbox reads)
-- ---------------------------------------------------------------------------
alter table public.feedback_messages enable row level security;
alter table public.roadmap_ideas enable row level security;
alter table public.roadmap_votes enable row level security;

revoke all on public.feedback_messages from anon, authenticated;
revoke all on public.roadmap_ideas from anon, authenticated;
revoke all on public.roadmap_votes from anon, authenticated;

grant all on public.feedback_messages to service_role;
grant all on public.roadmap_ideas to service_role;
grant all on public.roadmap_votes to service_role;
