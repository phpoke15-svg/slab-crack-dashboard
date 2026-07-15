alter table public.profiles
  add column if not exists hub_tool_order jsonb;

comment on column public.profiles.hub_tool_order is
  'Pro+ custom hub tile order — JSON array of CollecTool ids, e.g. ["slabcrack","slablab",...]';
