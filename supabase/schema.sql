-- CDAC Study App — Supabase schema
-- Run this in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Every table is scoped to auth.uid(), so one account can only ever read or write
-- its own progress. The study material lives in a PRIVATE storage bucket and is
-- only reachable through short-lived signed URLs handed out to logged-in users.

-- ---------------------------------------------------------------- progress ---
create table if not exists public.task_progress (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day_id     text        not null,
  item_index int         not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_id, item_index)
);

create table if not exists public.day_completion (
  user_id      uuid not null references auth.users(id) on delete cascade,
  day_id       text not null,
  completed_at date not null,
  primary key (user_id, day_id)
);

create table if not exists public.revision_done (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day_id    text not null,
  gap_index int  not null,
  primary key (user_id, day_id, gap_index)
);

create table if not exists public.user_settings (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  exam_date date not null default '2026-11-08'
);

create table if not exists public.mocks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  section    text        not null default 'A+B',
  attempted  int         not null default 0,
  correct    int         not null default 0,
  wrong      int         not null default 0,
  note       text        not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.weak_topics (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  topic      text        not null,
  note       text        not null default '',
  sev        text        not null default 'med' check (sev in ('high','med','low')),
  fixed      boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mocks_user_date_idx      on public.mocks (user_id, date desc);
create index if not exists weak_topics_user_idx     on public.weak_topics (user_id, fixed, sev);
create index if not exists task_progress_user_idx   on public.task_progress (user_id, day_id);

-- -------------------------------------------------------------------- RLS ---
alter table public.task_progress  enable row level security;
alter table public.day_completion enable row level security;
alter table public.revision_done  enable row level security;
alter table public.user_settings  enable row level security;
alter table public.mocks          enable row level security;
alter table public.weak_topics    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'task_progress','day_completion','revision_done','user_settings','mocks','weak_topics'
  ]
  loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);

    execute format(
      'create policy "own rows select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format(
      'create policy "own rows update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage ---
-- Private bucket: NOT public. Files are served only via signed URLs.
insert into storage.buckets (id, name, public)
values ('material', 'material', false)
on conflict (id) do nothing;

drop policy if exists "material read for authenticated" on storage.objects;
create policy "material read for authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'material');

-- Uploads happen through scripts/upload-material.mjs using the service-role key,
-- which bypasses RLS. No insert/update policy is granted to normal users on purpose.
