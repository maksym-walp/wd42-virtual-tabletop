-- ================================================================
-- The "calendar" service (custom fantasy calendars: months/weekdays/
-- seasons/moons + lore events) is rebranded to "Хронологія" (Chronology) —
-- a full technical rename, service directory/code included (see
-- services/chronology). Table names inside the schema are left as-is
-- (calendars, calendar_months, calendar_weekdays, calendar_seasons,
-- calendar_moons, calendar_events, event_recurrence) — a "calendar" is
-- still a calendar; chronology is the calendars+events domain as a whole,
-- so only the schema itself needs the new name.
-- ================================================================

ALTER SCHEMA calendar RENAME TO chronology;
