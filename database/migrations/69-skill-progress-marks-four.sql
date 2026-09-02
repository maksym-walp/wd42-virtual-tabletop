-- ================================================================
-- Migration: a skill now levels up after 4 progress circles + the
-- "+1" action (was 5 + 1). Clamp any rows that already sat at 5,
-- then swap the CHECK 0..5 for 0..4.
--
-- Guarded like migration 06/09: on installs that replay every
-- migration from scratch against an already-current schema the
-- constraint may already be 0..4 — DROP ... IF EXISTS + ADD is
-- still safe there (the clamp UPDATE is a no-op).
-- ================================================================

UPDATE character_sheet.skills
  SET progress_marks = 4
  WHERE progress_marks > 4;

ALTER TABLE character_sheet.skills
  DROP CONSTRAINT IF EXISTS skills_progress_marks_check;

ALTER TABLE character_sheet.skills
  ADD CONSTRAINT skills_progress_marks_check
    CHECK (progress_marks BETWEEN 0 AND 4);
