-- ================================================================
-- Migration: campaign session recaps — locations, events, NPCs
--   Three rich-text fields (same HTML + entity-link chips as `content`)
--   for what the party visited, which lore events the session touched
--   and which NPCs appeared.
-- ================================================================

ALTER TABLE campaigns.campaign_sessions
  ADD COLUMN IF NOT EXISTS visited_locations TEXT,
  ADD COLUMN IF NOT EXISTS related_events    TEXT,
  ADD COLUMN IF NOT EXISTS npcs              TEXT;
