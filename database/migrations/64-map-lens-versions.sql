-- ================================================================
-- Time on maps: a lens's image can change over the years.
--
--   - maps.map_lens_versions: one image per (lens, year). The lens keeps
--     its identity + name in maps.map_lenses; its image_url moves here.
--     `year` is nullable — a null-year row is the lens's "timeless"
--     image, shown whenever the view has no active year (a lens with no
--     dated versions, or a viewer with no timeline). Same
--     "null = unrestricted default" convention as map_pins.lens_ids /
--     visible_campaign_ids (see 61-map-pins-lens-campaign-visibility.sql).
--   - maps.map_pins.start_year / end_year: an optional [start, end]
--     existence window. A pin only renders when the active year falls
--     within the range; NULL on either side means "unbounded that way".
--
-- DESTRUCTIVE: map_lenses.image_url is dropped — apply together with the
-- maps-service deploy that reads lenses through map_lens_versions.
-- ================================================================

CREATE TABLE IF NOT EXISTS maps.map_lens_versions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    map_lens_id UUID         NOT NULL REFERENCES maps.map_lenses(id) ON DELETE CASCADE,
    year        INT,                     -- nullable: NULL = "timeless" fallback image
    image_url   VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_lens_versions_lens_id ON maps.map_lens_versions(map_lens_id);

-- At most one dated row per (lens, year), and at most one timeless row per lens.
-- (A plain UNIQUE(map_lens_id, year) wouldn't constrain the NULL-year rows.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_map_lens_versions_lens_year
  ON maps.map_lens_versions(map_lens_id, year) WHERE year IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_map_lens_versions_lens_timeless
  ON maps.map_lens_versions(map_lens_id) WHERE year IS NULL;

-- Backfill: each existing lens image becomes that lens's timeless version.
INSERT INTO maps.map_lens_versions (map_lens_id, year, image_url)
SELECT id, NULL, image_url FROM maps.map_lenses;

ALTER TABLE maps.map_lenses DROP COLUMN IF EXISTS image_url;

-- ----------------------------------------------------------------
-- Pins gain an optional [start_year, end_year] existence window.
-- ----------------------------------------------------------------
ALTER TABLE maps.map_pins
  ADD COLUMN IF NOT EXISTS start_year INT,
  ADD COLUMN IF NOT EXISTS end_year   INT;

DO $$ BEGIN
  ALTER TABLE maps.map_pins ADD CONSTRAINT map_pins_year_range_chk
    CHECK (start_year IS NULL OR end_year IS NULL OR start_year <= end_year);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
