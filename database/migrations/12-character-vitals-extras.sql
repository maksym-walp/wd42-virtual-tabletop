-- ================================================================
-- Migration: temporary HP, manual passive-defense bonus, and the
-- game/narrative inspiration split.
-- ================================================================

ALTER TABLE character_sheet.characters
  ADD COLUMN IF NOT EXISTS temp_hp SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defense_bonus SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspiration_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS narrative_inspiration_die VARCHAR(10);
