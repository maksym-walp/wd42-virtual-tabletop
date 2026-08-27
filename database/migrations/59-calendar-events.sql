-- ================================================================
-- calendar_events: lore/session events pinned to a point in a calendar.
--   - campaign_id NULL  -> global lore event, shown in every campaign
--                          using this calendar.
--   - campaign_id set   -> belongs to that one campaign only. Cross-service
--                          ref (calendar -> campaigns), so — same convention
--                          as campaign_characters.character_id (see
--                          23-campaigns-service.sql) — it's a FK-less plain
--                          UUID column, just indexed.
--   - is_public gates visibility for non-managers (regular authenticated
--     users see only is_public events; admin/game_master, already the only
--     roles that can write to a calendar, see everything) — same shape as
--     calendar.calendars.is_private, inverted.
--   - year/month_id/day are independently nullable: an event can be pinned
--     as loosely or precisely in time as the GM knows it.
-- ================================================================

CREATE TYPE calendar.event_recurrence AS ENUM ('none', 'yearly', 'monthly', 'weekly');

CREATE TABLE IF NOT EXISTS calendar.calendar_events (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id  UUID         NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    campaign_id  UUID,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    color        VARCHAR(7)   NOT NULL,
    is_public    BOOLEAN      NOT NULL DEFAULT true,
    year         INT,
    month_id     UUID         REFERENCES calendar.calendar_months(id) ON DELETE CASCADE,
    day          INT          CHECK (day IS NULL OR day > 0),
    recurrence   calendar.event_recurrence NOT NULL DEFAULT 'none',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar.calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_campaign_id ON calendar.calendar_events(campaign_id);
