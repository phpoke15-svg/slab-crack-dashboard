-- Run this FIRST if a previous schema attempt failed or left partial tables.
-- Safe to run multiple times.

drop table if exists public.anomalies cascade;
drop table if exists public.watchlist_cards cascade;
drop table if exists public.cards cascade;

drop table if exists public.slab_anomalies cascade;
drop table if exists public.slab_watchlist_cards cascade;
drop table if exists public.slab_cards cascade;
