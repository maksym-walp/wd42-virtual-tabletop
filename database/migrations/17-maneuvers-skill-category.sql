-- ================================================================
-- Migration: split the maneuvers catalog into two categories
--   "вміння" (skill, rogue) and "маневри" (maneuver, fighter) —
--   still one service/table, just filtered by category. Existing
--   rows default to 'maneuver' since they were all fighter maneuvers
--   historically.
-- ================================================================

ALTER TABLE maneuvers.entries
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'maneuver'
    CHECK (category IN ('skill', 'maneuver'));

CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_category ON maneuvers.entries(category);
