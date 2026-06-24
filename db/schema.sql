-- PARLOR (trivia-generator) — full Postgres schema (Neon).
-- Run with: psql "$DATABASE_URL" -f db/schema.sql  (or paste into the Neon SQL editor).
-- Conventions match fantasy-football-tool and music-festival-analyzer: RLS on
-- every table, public read policy, writes via a privileged pipeline role only.
-- NOTE: the RLS policies below are Supabase-flavored but valid Postgres; on Neon
-- they're optional — least privilege is enforced by using a read-only role for
-- the frontend connection string. They do no harm if left in place.

-- ── facts: the atomic unit. Questions are forged FROM facts, never stored alone. ──
create table if not exists facts (
  id            uuid primary key default gen_random_uuid(),
  content_hash  text not null unique,           -- sha256 of (source, subject, fact_text) → idempotent upserts
  source        text not null check (source in ('wikipedia','deezer','sleeper','espn','tmdb','restcountries','opentdb','manual','curated')),
  category      text not null check (category in ('history','music','sports','screen','geography','wildcard')),
  subject       text not null,                  -- "Lollapalooza", "Patrick Mahomes", "Pulp Fiction"
  fact_text     text not null,                  -- human-readable, citeable sentence
  year          int,                            -- fuels year_guess
  numeric_value double precision,               -- fuels higher_lower
  numeric_unit  text,                           -- "Deezer fans", "TMDB rating", ...
  lat           double precision,               -- fuels where (THE MAP)
  lng           double precision,
  image_url     text,
  source_url    text,                           -- provenance, always kept
  popularity    double precision,               -- 0-100 source signal → difficulty engine
  meta          jsonb default '{}'::jsonb,      -- raw API payload slice
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists facts_category_idx on facts (category);
create index if not exists facts_year_idx on facts (year) where year is not null;
create index if not exists facts_numeric_idx on facts (numeric_unit, numeric_value) where numeric_value is not null;

-- ── questions: typed, ready-to-render game fuel ──
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  content_hash  text not null unique,
  fact_id       uuid references facts(id) on delete cascade,
  qtype         text not null check (qtype in ('multiple_choice','year_guess','higher_lower','clue','where','audio_guess','image_guess','connections','seance','ladder','thread')),
  category      text not null check (category in ('history','music','sports','screen','geography','wildcard')),
  difficulty    int not null default 3 check (difficulty between 1 and 5),
  prompt        text not null,                  -- the clue / question / pair framing
  correct       text not null,                  -- answer text, or the truth year/value as text
  choices       jsonb,                          -- MC: ["a","b","c","d"] (correct included, shuffle client-side)
  year          int,                            -- year_guess truth
  value_a       double precision,               -- higher_lower anchor value
  value_b       double precision,               -- higher_lower hidden value
  subject_a     text,                           -- higher_lower anchor label
  subject_b     text,                           -- higher_lower hidden label
  unit          text,                           -- higher_lower metric label
  lat           double precision,               -- where (THE MAP) truth coordinates
  lng           double precision,
  image_url     text,
  source_url    text,
  audio_url     text,                           -- audio_guess (THE JUKEBOX): streamed clip
  melody        jsonb,                          -- audio_guess offline synth: [{n,d}]
  groups        jsonb,                          -- connections: [{label,members,difficulty}]
  clues         jsonb,                          -- seance: ordered clue strings (vague→specific)
  candidates    jsonb,                          -- ladder: [{label,category,region,magnitude}]
  chain         jsonb,                          -- thread: [{prompt,answer,link}] last-letter→first-letter
  theme         text,                           -- thread: master theme (the final answer)
  theme_choices jsonb,                          -- thread: ["theme", distractors...] for the final guess
  created_at    timestamptz default now()
);

create index if not exists questions_qtype_idx on questions (qtype, category, difficulty);

-- ── daily_sets: deterministic shared boards (Wordle-style "same board for everyone") ──
create table if not exists daily_sets (
  id          uuid primary key default gen_random_uuid(),
  set_date    date not null,
  mode        text not null check (mode in ('board','clock','wedges','streak','map','daily')),
  payload     jsonb not null,                   -- ordered question ids + board layout
  created_at  timestamptz default now(),
  unique (set_date, mode)
);

-- ── scores: global leaderboard. Writes go through the submit-score Edge
-- Function (service role), NEVER the anon client — so there is deliberately no
-- public insert policy. Reads are public via the leaderboard view. ──
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

-- top-200 per room, exposed read-only to the anon key
create or replace view leaderboard as
  select room, name, score, created_at
  from (
    select room, name, score, created_at,
           row_number() over (partition by room order by score desc, created_at asc) as rn
    from scores
  ) ranked
  where rn <= 200;

-- ── RLS: public read, service-role write (house convention) ──
alter table facts enable row level security;
alter table questions enable row level security;
alter table daily_sets enable row level security;
alter table scores enable row level security;

drop policy if exists "public read scores" on scores;
create policy "public read scores" on scores for select using (true);
-- (no insert/update/delete policy: anon cannot write; the Edge Function uses the
--  service role which bypasses RLS)

drop policy if exists "public read facts" on facts;
create policy "public read facts" on facts for select using (true);

drop policy if exists "public read questions" on questions;
create policy "public read questions" on questions for select using (true);

drop policy if exists "public read daily_sets" on daily_sets;
create policy "public read daily_sets" on daily_sets for select using (true);

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists facts_updated_at on facts;
create trigger facts_updated_at before update on facts
  for each row execute function set_updated_at();
