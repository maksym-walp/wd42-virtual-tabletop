-- ================================================================
-- Per-location marker customization: users pick/upload a marker icon
-- and choose its zoom level (1..4) in-app, overriding the type preset.
-- Both nullable — when unset, the location falls back to its type's
-- config icon/level (public/map-markers/types.json).
-- ================================================================

ALTER TABLE maps.locations ADD COLUMN IF NOT EXISTS marker_icon VARCHAR(500);
ALTER TABLE maps.locations ADD COLUMN IF NOT EXISTS marker_level SMALLINT
  CHECK (marker_level IS NULL OR marker_level BETWEEN 1 AND 4);
