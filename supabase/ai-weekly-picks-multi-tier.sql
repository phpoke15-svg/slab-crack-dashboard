-- Multi-tier AI weekly picks migration (run after ai-weekly-picks.sql)

alter table public.ai_weekly_picks
  add column if not exists bucket_tier text,
  add column if not exists projected_target_price numeric(12, 2);

update public.ai_weekly_picks
set bucket_tier = '1000'
where bucket_tier is null;

alter table public.ai_weekly_picks
  alter column bucket_tier set not null;

alter table public.ai_weekly_picks
  drop constraint if exists ai_weekly_picks_week_start_date_scrydex_id_grade_type_key;

alter table public.ai_weekly_picks
  drop constraint if exists ai_weekly_picks_week_start_date_scrydex_id_grade_type_key1;

do $$ begin
  alter table public.ai_weekly_picks
    add constraint ai_weekly_picks_week_tier_card_grade_key
    unique (week_start_date, bucket_tier, scrydex_id, grade_type);
exception when duplicate_object then null;
end $$;

create index if not exists ai_weekly_picks_week_tier_idx
  on public.ai_weekly_picks (week_start_date desc, bucket_tier);
