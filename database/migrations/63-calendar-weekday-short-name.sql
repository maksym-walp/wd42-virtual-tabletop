-- ================================================================
-- calendar.calendar_weekdays: short_name for compact display (mobile
-- CalendarView grid headers, day-of-week chips). Fantasy calendars can have
-- any number of weekdays with arbitrary names, so this can't be derived by
-- truncating `name` client-side (e.g. multi-word or non-Latin names don't
-- abbreviate predictably) — the GM sets it explicitly in the builder.
-- Nullable: existing rows have no short_name yet, and CalendarView falls
-- back to the full `name` when it's unset.
-- ================================================================

ALTER TABLE calendar.calendar_weekdays
    ADD COLUMN IF NOT EXISTS short_name VARCHAR(3);
