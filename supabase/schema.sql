-- Run this in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Supabase's built-in `auth.users` table handles accounts (email/password + Google)
-- automatically once you enable those providers in Authentication -> Providers.
-- These tables hold everything specific to this app.

create table if not exists user_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topics text[] not null default '{}',           -- e.g. ['B2B SaaS growth', 'fintech UX']
  tone_text text,                                 -- extracted text from an uploaded tone file, or null for default
  articles_per_week int not null default 2 check (articles_per_week between 1 and 7),
  scheduled_weekdays int[] not null default '{1,3}', -- 0=Sun .. 6=Sat, auto-computed from articles_per_week
  platform text not null default 'linkedin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  hashtags text[] not null default '{}',
  source_topic text,
  source_summary text,          -- brief note on what web-search finding this came from
  platform text not null default 'linkedin',
  created_at timestamptz not null default now()
);

create index if not exists articles_user_id_created_at_idx
  on articles (user_id, created_at desc);

-- Row Level Security: users can only ever see/edit their own data.
alter table user_config enable row level security;
alter table articles enable row level security;

create policy "Users manage their own config"
  on user_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read their own articles"
  on articles for select
  using (auth.uid() = user_id);

-- Articles are inserted by the server (service role key, bypasses RLS) via the
-- cron/generate job, not directly by users, so no insert policy for users here.
