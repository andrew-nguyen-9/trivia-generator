-- Widen facts_source_check to every source the ingests actually emit.
-- The constraint had drifted behind the pipeline: wiki_pkg_ingest (wikipedia_pkg),
-- trivia_ingest (jservice, quizapi), and the wikidata/dbpedia ingests all write
-- sources the old CHECK rejected, so every DB upsert of those facts failed with
-- facts_source_check (offline/seed mode never hits the constraint, which is why it
-- went unnoticed until the live-DB path was exercised).
-- Kept in lockstep with the dbt accepted_values test on stg_facts.source and the
-- inline CHECK in db/schema.sql. Idempotent: safe to re-run.
alter table facts drop constraint if exists facts_source_check;
alter table facts add constraint facts_source_check
  check (source in ('wikipedia','wikipedia_pkg','wikidata','dbpedia','deezer','sleeper','espn','tmdb','restcountries','opentdb','jservice','quizapi','curated','manual'));
