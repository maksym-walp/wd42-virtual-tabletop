-- ================================================================
-- calendar.calendars: a default (year, month) that CalendarView opens to
-- when there's no more specific date to show (a campaign's own
-- current_year/current_month_id, when the view is campaign-scoped, still
-- wins over this — this is the calendar-wide fallback, not an override).
-- default_month_id is ON DELETE SET NULL (not CASCADE like
-- calendar_seasons.start_month_id): deleting the month it points at should
-- just clear the default, not take the whole calendar down with it.
-- ================================================================

ALTER TABLE calendar.calendars
  ADD COLUMN IF NOT EXISTS default_year      INT,
  ADD COLUMN IF NOT EXISTS default_month_id  UUID REFERENCES calendar.calendar_months(id) ON DELETE SET NULL;
