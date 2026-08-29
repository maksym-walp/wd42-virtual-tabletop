-- ================================================================
-- chronology.calendar_events gains a place (a maps location OR a free-text
-- region — mutually exclusive), an optional end date (making a point event
-- a span), and a many-to-many set of participants (NPCs/creatures from the
-- compendium service). Powers the new "Події" tab (ChronologyEvents.jsx) —
-- events were previously only reachable one at a time via a day-grid cell.
--
-- location_id/entry_id are FK-less cross-service UUIDs (same convention as
-- calendar_events.campaign_id above): maps.locations and
-- compendium.compendium_entries live in other services' schemas.
-- end_year/end_month_id/end_day are independently nullable, same philosophy
-- as the existing start fields — unset means a point-in-time event.
-- ================================================================

ALTER TABLE chronology.calendar_events
  ADD COLUMN IF NOT EXISTS location_id  UUID,
  ADD COLUMN IF NOT EXISTS region       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS end_year     INT,
  ADD COLUMN IF NOT EXISTS end_month_id UUID REFERENCES chronology.calendar_months(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS end_day      INT CHECK (end_day IS NULL OR end_day > 0);

ALTER TABLE chronology.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_place_xor,
  ADD CONSTRAINT calendar_events_place_xor CHECK (NOT (location_id IS NOT NULL AND region IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_calendar_events_location_id ON chronology.calendar_events(location_id);

CREATE TABLE IF NOT EXISTS chronology.calendar_event_participants (
    event_id UUID NOT NULL REFERENCES chronology.calendar_events(id) ON DELETE CASCADE,
    entry_id UUID NOT NULL,
    PRIMARY KEY (event_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_entry_id ON chronology.calendar_event_participants(entry_id);
