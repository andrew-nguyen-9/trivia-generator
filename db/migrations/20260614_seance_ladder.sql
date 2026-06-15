-- Phase 6-7: add seance + ladder qtypes and their jsonb columns

-- Extend qtype check constraint
alter table questions drop constraint if exists questions_qtype_check;
alter table questions add constraint questions_qtype_check
  check (qtype in ('multiple_choice','year_guess','higher_lower','clue','where','seance','ladder'));

-- New columns (nullable — existing rows unaffected)
alter table questions add column if not exists clues      jsonb;
alter table questions add column if not exists candidates jsonb;
