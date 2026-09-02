-- ================================================================
-- Migration: unify the two "advancement" currencies into one.
--
-- Previously:
--   * character_sheet.characters.dev_points  — budget for skill-tree nodes
--   * character_sheet.skills.progress_marks  — free-to-click circles that
--     raise a skill's value, costing nothing
--
-- Now a single wallet: characters.experience_points. Spend is DERIVED,
-- not decremented — the sheet computes
--   spent = Σ skills[(value - base_value) * 5 + progress_marks]
--         + Σ unlocked non-root nodes.cost
-- so base_value snapshots each skill's value at the end of character
-- creation (the point-buy step is a separate pool, not experience).
--
-- Existing characters: base_value = current value, so remaining is never
-- negative on upgrade.
-- ================================================================

-- Guarded rename — skip if a prior replay already renamed the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'character_sheet' AND table_name = 'characters'
      AND column_name = 'dev_points'
  ) THEN
    ALTER TABLE character_sheet.characters RENAME COLUMN dev_points TO experience_points;
  END IF;
END $$;

ALTER TABLE character_sheet.skills
  ADD COLUMN IF NOT EXISTS base_value SMALLINT NOT NULL DEFAULT 1
    CHECK (base_value BETWEEN 0 AND 12);

UPDATE character_sheet.skills SET base_value = value WHERE base_value <> value;
