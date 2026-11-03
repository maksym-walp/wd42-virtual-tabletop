-- ================================================================
-- Хронологія: межі повторюваності події — рік, з якого й по який вона
-- повторюється (обидва незалежно необов'язкові: без початку — повторюється
-- "від завжди", без кінця — "назавжди"). Стосується лише подій із
-- recurrence != 'none' — для одноразової події не має сенсу.
-- ================================================================

ALTER TABLE chronology.calendar_events
    ADD COLUMN IF NOT EXISTS recurrence_start_year INT,
    ADD COLUMN IF NOT EXISTS recurrence_end_year INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chronology_calendar_events_recurrence_year_bounds_check'
  ) THEN
    ALTER TABLE chronology.calendar_events
        ADD CONSTRAINT chronology_calendar_events_recurrence_year_bounds_check
        CHECK (recurrence_start_year IS NULL OR recurrence_end_year IS NULL OR recurrence_end_year >= recurrence_start_year);
  END IF;
END $$;
