-- ================================================================
-- Хронологія: безіменний цикл днів і повна «поточна дата».
--
--   * calendars.week_length — тривалість «тижня» (циклу днів) у днях для
--     календарів, де дні тижня не мають назв (у дверґів — «день циклу 1…10»).
--     Якщо в календаря є названі дні тижня (calendar_weekdays), довжина
--     тижня — їх кількість і week_length ігнорується. NULL і жодного названого
--     дня — тижнів у календарі немає.
--   * calendars.default_day — день місяця «поточної дати» (разом із
--     default_year/default_month_id; усі три — у безперервному відліку).
-- ================================================================

ALTER TABLE chronology.calendars
    ADD COLUMN IF NOT EXISTS week_length INT CHECK (week_length IS NULL OR week_length > 0),
    ADD COLUMN IF NOT EXISTS default_day INT CHECK (default_day IS NULL OR default_day > 0);
