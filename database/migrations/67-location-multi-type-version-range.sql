-- ================================================================
-- Locations can carry several type keys at once, and both the type
-- set and the [start, end] year window can change per chronological
-- version.
--
--   - maps.locations.type (single VARCHAR) -> types (VARCHAR[]).
--   - maps.location_versions.end_year: the version stops applying after
--     this year (NULL = open-ended). start_year <= end_year enforced.
--   - maps.location_versions.types: per-version type override
--     (NULL = inherit maps.locations.types).
-- ================================================================

-- --- locations: single type -> multi-type array -----------------
ALTER TABLE maps.locations ADD COLUMN IF NOT EXISTS types VARCHAR(50)[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'maps' AND table_name = 'locations' AND column_name = 'type'
  ) THEN
    UPDATE maps.locations
      SET types = ARRAY[type]
      WHERE type IS NOT NULL AND type <> '' AND array_length(types, 1) IS NULL;
    ALTER TABLE maps.locations DROP COLUMN type;
  END IF;
END $$;

-- --- location_versions: end year + per-version type override -----
ALTER TABLE maps.location_versions
  ADD COLUMN IF NOT EXISTS end_year INT,
  ADD COLUMN IF NOT EXISTS types    VARCHAR(50)[];   -- NULL = inherit base

DO $$ BEGIN
  ALTER TABLE maps.location_versions ADD CONSTRAINT location_versions_year_range_chk
    CHECK (start_year IS NULL OR end_year IS NULL OR start_year <= end_year);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
