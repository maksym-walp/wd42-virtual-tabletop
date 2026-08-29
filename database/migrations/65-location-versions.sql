-- ================================================================
-- Locations change over time: a city is a "Thriving Capital" in year
-- 500, "Ruins" in 600. The time-varying lore (description, gm_note,
-- image) moves from maps.locations to maps.location_versions, one row
-- per start_year.
--
--   - start_year is nullable — a null-year row is the location's "base"
--     version, shown whenever no dated version applies (no timeline, or
--     a slider year before the earliest version). Same convention as
--     maps.map_lens_versions (64-map-lens-versions.sql).
--   - image_url is a single VARCHAR here (the per-location image_urls[]
--     gallery is retired); existing galleries keep their first image.
--
-- maps.locations keeps created_by (its owner), NOT campaign_id —
-- locations are a reusable, campaign-independent library (35-maps-
-- service.sql). name / type / marker_icon / marker_level stay on the
-- base row.
--
-- DESTRUCTIVE: maps.locations loses description / gm_note / image_urls —
-- apply together with the maps-service + frontend deploy.
-- ================================================================

CREATE TABLE IF NOT EXISTS maps.location_versions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID         NOT NULL REFERENCES maps.locations(id) ON DELETE CASCADE,
    start_year  INT,                     -- nullable: NULL = base version
    description TEXT,
    gm_note     TEXT,
    image_url   VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_versions_location_id ON maps.location_versions(location_id);

-- At most one row per (location, year), and at most one base row per location.
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_versions_loc_year
  ON maps.location_versions(location_id, start_year) WHERE start_year IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_versions_loc_base
  ON maps.location_versions(location_id) WHERE start_year IS NULL;

-- Backfill: each location's current lore becomes its base version.
INSERT INTO maps.location_versions (location_id, start_year, description, gm_note, image_url)
SELECT id, NULL, description, gm_note, image_urls[1] FROM maps.locations;

ALTER TABLE maps.locations
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS gm_note,
  DROP COLUMN IF EXISTS image_urls;
