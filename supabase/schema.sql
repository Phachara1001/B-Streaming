-- =====================================================================
-- B-Streaming  |  Supabase schema
-- Run this whole file in: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) rooms : one row per karaoke room
--    state = latest snapshot of the room (current song, queue, volume...)
--            written by the host screen, read by remotes for catch-up
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null check (char_length(name) between 1 and 60),
  music_mode     text not null default 'karaoke' check (music_mode in ('karaoke', 'music')),
  state          jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists rooms_created_at_idx on public.rooms (created_at desc);
create index if not exists rooms_active_idx on public.rooms (is_active, last_active_at desc);

-- ---------------------------------------------------------------------
-- 2) song_history : every song link that was queued / played / skipped
-- ---------------------------------------------------------------------
create table if not exists public.song_history (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  video_id     text not null,
  url          text not null,
  title        text not null,
  artist       text,
  thumbnail    text,
  duration     text,
  requested_by text,
  event        text not null check (event in ('queued', 'played', 'skipped')),
  created_at   timestamptz not null default now()
);

create index if not exists song_history_room_idx on public.song_history (room_id, created_at desc);
create index if not exists song_history_event_idx on public.song_history (room_id, event);

-- ---------------------------------------------------------------------
-- 3) Row Level Security
--    The app has no login, so the anon key may read/write.
--    Anyone who knows a room code can use that room (same as before).
-- ---------------------------------------------------------------------
alter table public.rooms        enable row level security;
alter table public.song_history enable row level security;

drop policy if exists "rooms_select"  on public.rooms;
drop policy if exists "rooms_insert"  on public.rooms;
drop policy if exists "rooms_update"  on public.rooms;
drop policy if exists "rooms_delete"  on public.rooms;
drop policy if exists "history_select" on public.song_history;
drop policy if exists "history_insert" on public.song_history;
drop policy if exists "history_delete" on public.song_history;

create policy "rooms_select"   on public.rooms for select to anon, authenticated using (true);
create policy "rooms_insert"   on public.rooms for insert to anon, authenticated with check (true);
create policy "rooms_update"   on public.rooms for update to anon, authenticated using (true) with check (true);
create policy "rooms_delete"   on public.rooms for delete to anon, authenticated using (true);

create policy "history_select" on public.song_history for select to anon, authenticated using (true);
create policy "history_insert" on public.song_history for insert to anon, authenticated with check (true);
create policy "history_delete" on public.song_history for delete to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- 4) Realtime : room list updates live on the "choose a room" page
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_history'
  ) then
    alter publication supabase_realtime add table public.song_history;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5) Housekeeping : remove rooms unused for 3 days (history is deleted by cascade)
--    Run manually, or schedule it with pg_cron (see below).
-- ---------------------------------------------------------------------
create or replace function public.cleanup_old_rooms()
returns integer
language plpgsql
security definer
as $$
declare
  removed integer;
begin
  delete from public.rooms where last_active_at < now() - interval '3 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Optional: enable the pg_cron extension (Database > Extensions) and then run:
-- select cron.schedule('bs-cleanup-rooms', '0 3 * * *', $$ select public.cleanup_old_rooms(); $$);

