-- ════════════════════════════════════════════════════════════════════════
-- PARLOR v3 §3.0 — Foundation Freeze. The one shared-DB migration for v3.
--
-- QTYPE: no new enum members. The v3 audio room ("The Overture") REUSES the
-- existing `audio_guess` qtype (it absorbs the retired Jukebox's audio mechanic;
-- previews are already ingested). The weekly case ("The Cold Case") is a
-- Mystery-style server-generated room, not a per-question qtype — like the
-- Mystery itself, it needs no `questions.qtype` member. So the qtype CHECK in
-- db/schema.sql is unchanged.
--
-- ROOMS: legacy rooms (jukebox/gallery/blitz/connections/lobby) are retired at
-- the APP layer in §3.0 (routes + registry removed). At the DB layer we keep
-- their values for historical score rows and ADD the live v3 deck + the two new
-- rooms. Additive only — a CHECK validates on write, never rewrites old rows.
--
-- Idempotent: safe to re-run (drop-if-exists, then re-add).
-- ════════════════════════════════════════════════════════════════════════

alter table scores drop constraint if exists scores_room_check;
alter table scores add constraint scores_room_check check (room in (
  'board','clock','wedges','streak','map','daily',
  'mystery','gauntlet','thread','seance','ladder',
  'overture','cold-case',
  -- retired app-side in v3, retained for historical rows:
  'jukebox','gallery','blitz','connections'
));
