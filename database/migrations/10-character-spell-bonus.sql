-- ================================================================
-- Migration: manual bonus to a character's max known-spells cap
-- (max known spells = mysticism skill value + spell_bonus)
-- ================================================================

ALTER TABLE character_sheet.characters
  ADD COLUMN IF NOT EXISTS spell_bonus SMALLINT NOT NULL DEFAULT 0;
