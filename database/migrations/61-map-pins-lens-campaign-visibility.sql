-- ================================================================
-- map_pins: lens-specific and campaign-specific visibility.
--
--   - lens_ids: which of the map's own lenses (maps.map_lenses) show this
--     pin. Empty (the default) means "not restricted to specific lenses" —
--     every pin that existed before this migration keeps rendering on
--     every lens, rather than vanishing everywhere the moment this column
--     appears; a GM opts a pin into lens-restriction by setting this array.
--   - visible_campaign_ids: which campaigns may see this pin. Empty (the
--     default) means "visible to everyone with map access" — same
--     unrestricted-by-default convention as lens_ids above.
--
-- Both are cross-service/cross-schema id arrays (map_lenses is same-schema
-- so lens_ids IS checked at the service layer that its ids belong to the
-- map; campaigns.campaigns lives in another service's schema, so
-- visible_campaign_ids is trusted the same FK-less way every other
-- cross-service id column in this repo is, e.g.
-- campaign_characters.character_id). Postgres CHECK constraints can't
-- validate array elements against another table's rows, so there is no
-- FK here either way.
-- ================================================================

ALTER TABLE maps.map_pins
  ADD COLUMN IF NOT EXISTS lens_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visible_campaign_ids UUID[] NOT NULL DEFAULT '{}';

-- GIN indexes so "is X one of this pin's ids" (ANY()/&&) queries — used by
-- the player-visibility filter — can use an index instead of scanning
-- every pin on the map.
CREATE INDEX IF NOT EXISTS idx_map_pins_lens_ids ON maps.map_pins USING GIN (lens_ids);
CREATE INDEX IF NOT EXISTS idx_map_pins_visible_campaign_ids ON maps.map_pins USING GIN (visible_campaign_ids);
