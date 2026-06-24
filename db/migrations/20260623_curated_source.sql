-- Allow the 'curated' fact source on the live DB.
-- curated_ingest.py + bronze (curated.jsonl) + seed bank all already emit
-- source='curated', but the original facts_source_check predated it, so any DB
-- write of a curated fact failed with facts_source_check (offline/seed mode
-- never hits the constraint, which is why it went unnoticed).
-- Idempotent: safe to re-run.
alter table facts drop constraint if exists facts_source_check;
alter table facts add constraint facts_source_check
  check (source in ('wikipedia','deezer','sleeper','espn','tmdb','restcountries','opentdb','manual','curated'));
