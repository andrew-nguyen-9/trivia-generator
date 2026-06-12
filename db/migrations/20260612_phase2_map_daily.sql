-- Phase 2: THE MAP room (qtype 'where' + coordinates) and THE DAILY room.
-- Run after db/schema.sql installs the v1 schema.

alter table facts add column if not exists lat double precision;
alter table facts add column if not exists lng double precision;

alter table questions add column if not exists lat double precision;
alter table questions add column if not exists lng double precision;

alter table questions drop constraint if exists questions_qtype_check;
alter table questions add constraint questions_qtype_check
  check (qtype in ('multiple_choice','year_guess','higher_lower','clue','where'));

alter table daily_sets drop constraint if exists daily_sets_mode_check;
alter table daily_sets add constraint daily_sets_mode_check
  check (mode in ('board','clock','wedges','streak','map','daily'));
