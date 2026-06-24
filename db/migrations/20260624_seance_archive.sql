-- Phase 2.9: The Séance daily archive.
-- Pre-generated, date-keyed logic puzzles (one per day, identical for everyone).
-- Written ahead of time by scripts/generate-seance.ts (pipeline write role);
-- read by the frontend (read-only role). No offline/seed fallback for Séance —
-- if a day's row is absent the room shows a dark state. The full table is the
-- archive: debugging + future archive-play of any past date.

create table if not exists seance_puzzles (
  play_date   date primary key,
  weekday     int  not null,
  spirit      text not null,
  seed        bigint not null,
  payload     jsonb not null,   -- full SeancePuzzle (see frontend/lib/seance.ts)
  created_at  timestamptz not null default now()
);

-- harmless on Neon; keeps parity with the rest of the schema (CLAUDE.md)
alter table seance_puzzles enable row level security;
do $$ begin
  create policy seance_puzzles_public_read on seance_puzzles for select using (true);
exception when duplicate_object then null; end $$;
