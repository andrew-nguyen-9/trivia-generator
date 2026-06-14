-- Phase 3 — new question types (audio_guess, image_guess, connections),
-- their backing columns, and the global leaderboard.
-- Idempotent; safe to run on an existing PARLOR database.

-- 1. extend the questions.qtype check + add type-specific columns
alter table questions drop constraint if exists questions_qtype_check;
alter table questions add constraint questions_qtype_check
  check (qtype in ('multiple_choice','year_guess','higher_lower','clue','where',
                   'audio_guess','image_guess','connections'));

alter table questions add column if not exists audio_url text;
alter table questions add column if not exists melody    jsonb;
alter table questions add column if not exists groups    jsonb;

-- 2. leaderboard
create table if not exists scores (
  id          uuid primary key default gen_random_uuid(),
  room        text not null check (room in (
                'board','clock','wedges','streak','map','daily',
                'jukebox','gallery','blitz','connections')),
  name        text not null check (char_length(name) between 1 and 12),
  score       int not null check (score >= 0),
  created_at  timestamptz default now()
);
create index if not exists scores_room_idx on scores (room, score desc);

create or replace view leaderboard as
  select room, name, score, created_at
  from (
    select room, name, score, created_at,
           row_number() over (partition by room order by score desc, created_at asc) as rn
    from scores
  ) ranked
  where rn <= 200;

alter table scores enable row level security;
drop policy if exists "public read scores" on scores;
create policy "public read scores" on scores for select using (true);
-- intentionally NO insert policy: writes come from the submit-score Edge Function
-- (service role bypasses RLS); the anon key can only read.
