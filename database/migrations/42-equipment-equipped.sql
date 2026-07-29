-- ================================================================
-- Migration: "equipped" armor toggle
--   Passive defense used to be one manual number (defense_bonus).
--   It's now: (defense_value of the ONE equipped armor piece) + defense_bonus
--   (defense_bonus becomes a pure "Модифікатор" the player edits directly,
--   no more back-solving from a typed total). Mutual exclusivity — only one
--   armor row may have is_equipped = true per character — is enforced in
--   equipment.model.js's patch(), not here.
-- ================================================================

ALTER TABLE character_sheet.equipment
  ADD COLUMN IF NOT EXISTS is_equipped BOOLEAN NOT NULL DEFAULT false;
