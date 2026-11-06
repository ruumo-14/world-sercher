-- Asteria / World Sercher account and save tables
-- Run this entire script once in Supabase SQL Editor.
-- The Vercel server uses SUPABASE_SECRET_KEY only on the server.
-- Do not add a public/anon policy to these tables.

create table if not exists public.game_users (
  id uuid primary key default gen_random_uuid(),
  username varchar(16) not null,
  username_lower varchar(16) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  user_id uuid primary key references public.game_users(id) on delete cascade,
  character_name varchar(12) not null default '冒険者',
  x double precision not null default 1600,
  y double precision not null default 1370,
  level integer not null default 1,
  gold integer not null default 0,
  game_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_users enable row level security;
alter table public.game_saves enable row level security;

-- No anon/authenticated policies are intentionally created.
-- Only the server-side Supabase secret key can access these tables.