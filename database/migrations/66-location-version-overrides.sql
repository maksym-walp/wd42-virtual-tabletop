-- ================================================================
-- Location versions can now also override the presentation fields that
-- used to be fixed on maps.locations: the display name and the map
-- marker (icon + zoom level). A city can be "Столиця" with a 🏛 marker
-- in year 500 and "Руїни" with a 🏚 marker in year 600.
--
-- All three are nullable — NULL means "inherit the base maps.locations
-- value" (same convention as start_year = NULL for the base version).
-- ================================================================

ALTER TABLE maps.location_versions
  ADD COLUMN IF NOT EXISTS name         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS marker_icon  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS marker_level SMALLINT;

DO $$ BEGIN
  ALTER TABLE maps.location_versions ADD CONSTRAINT location_versions_marker_level_chk
    CHECK (marker_level IS NULL OR marker_level BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
