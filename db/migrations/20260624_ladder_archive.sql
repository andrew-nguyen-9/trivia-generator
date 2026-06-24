-- Phase 2.10: Climb of the Initiate daily archive.
-- Pre-generated, date-keyed logic/math ladders (one per day, identical for all).
-- Written ahead by scripts/generate-ladder.ts (pipeline write role); read by the
-- frontend (read-only role). No offline/seed fallback — absent row ⇒ dark state.
-- The table is the archive: debugging + future archive-play of any past date.

create table if not exists ladder_puzzles (
  play_date   date primary key,
  weekday     int  not null,
  rite        text not null,
  seed        bigint not null,
  payload     jsonb not null,   -- full LadderPuzzle (see frontend/lib/ladder.ts)
  created_at  timestamptz not null default now()
);

alter table ladder_puzzles enable row level security;
do $$ begin
  create policy ladder_puzzles_public_read on ladder_puzzles for select using (true);
exception when duplicate_object then null; end $$;
