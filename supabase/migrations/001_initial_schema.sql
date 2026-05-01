create extension if not exists pgcrypto;

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  dark_mode boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(owner_uid)
);

create table if not exists public.habits_log (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  habit_key text not null,
  logged_date date not null default current_date,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(owner_uid, habit_key, logged_date)
);

create table if not exists public.weekly_targets (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  week_number int not null,
  year int not null,
  target_text text not null,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  deadline date,
  data_source text default 'manual',
  status text not null default 'active' check (status in ('active','complete','paused','abandoned')),
  created_at timestamptz not null default now()
);

create table if not exists public.estate_flags (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  flag_key text not null,
  flag_level text not null check (flag_level in ('red','amber','green')),
  flag_message text,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.ventures (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  status text not null default 'planning',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  day_of_week text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  type text not null,
  duration_minutes int not null default 0,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  metric_key text not null,
  amount numeric not null default 0,
  period_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.vision_board (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption text,
  position_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  group_id uuid,
  storage_path text not null,
  tab_category text not null,
  title text,
  version int not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_analytics (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  metric_key text not null,
  metric_value numeric not null,
  recorded_at timestamptz not null default now(),
  period_date date not null default current_date
);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  agent_name text not null,
  status text not null default 'running',
  output jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

