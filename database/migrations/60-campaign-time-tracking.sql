-- ================================================================
-- Campaign time tracking: links a campaign to one of the calendar
-- service's custom calendars and tracks its current in-fiction date.
-- calendar_id / current_month_id are cross-service refs (campaigns ->
-- calendar) — same convention as campaign_characters.character_id (see
-- 23-campaigns-service.sql): FK-less plain UUID columns, all nullable
-- since a campaign isn't required to track a calendar at all.
-- ================================================================

ALTER TABLE campaigns.campaigns
  ADD COLUMN IF NOT EXISTS calendar_id      UUID,
  ADD COLUMN IF NOT EXISTS current_year     INT,
  ADD COLUMN IF NOT EXISTS current_month_id UUID,
  ADD COLUMN IF NOT EXISTS current_day      INT;

CREATE INDEX IF NOT EXISTS idx_campaigns_calendar_id ON campaigns.campaigns(calendar_id) WHERE calendar_id IS NOT NULL;
