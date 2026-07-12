-- ================================================================
-- Migration: dev_points + nullable death_scale
-- ================================================================

-- Budget of development points per character
ALTER TABLE character_sheet.characters
  ADD COLUMN IF NOT EXISTS dev_points SMALLINT NOT NULL DEFAULT 0;

-- Make death_scale nullable (NULL = nothing selected on UI)
ALTER TABLE character_sheet.characters
  ALTER COLUMN death_scale DROP DEFAULT;

ALTER TABLE character_sheet.characters
  ALTER COLUMN death_scale DROP NOT NULL;

-- Replace the NOT NULL-only-friendly CHECK with a NULL-aware one
ALTER TABLE character_sheet.characters
  DROP CONSTRAINT IF EXISTS characters_death_scale_check;

ALTER TABLE character_sheet.characters
  ADD CONSTRAINT characters_death_scale_check
    CHECK (death_scale IS NULL OR death_scale BETWEEN -3 AND 3);
