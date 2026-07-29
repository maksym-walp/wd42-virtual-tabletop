-- ================================================================
-- Migration: smart HP tracking for combat tracker combatants
--   health stays "current HP"; max_health and temp_hp let the tracker
--   render (current+temp)/max and apply damage to temp HP first —
--   mirroring the character sheet's own current_hp/temp_hp mechanic.
-- ================================================================

ALTER TABLE campaigns.combatants
  ADD COLUMN IF NOT EXISTS max_health SMALLINT,
  ADD COLUMN IF NOT EXISTS temp_hp SMALLINT NOT NULL DEFAULT 0;
