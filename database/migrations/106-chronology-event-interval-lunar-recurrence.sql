-- ================================================================
-- Хронологія: нові види повторюваності подій.
--
--   * 'interval_days' — кожні N днів від дати події (recurrence_interval = N);
--   * 'lunar' — кожні N циклів супутника (recurrence_interval = N, moon_id)
--     у день, коли супутник досягає фази moon_phase (відсоток циклу:
--     0 — новий, 50 — повний), починаючи з циклу дати події.
--
-- moon_id — супутник того самого календаря (перевіряє сервіс); якщо супутника
-- видалили, подія просто перестає повторюватись (SET NULL).
-- ================================================================

ALTER TYPE chronology.event_recurrence ADD VALUE IF NOT EXISTS 'interval_days';
ALTER TYPE chronology.event_recurrence ADD VALUE IF NOT EXISTS 'lunar';

ALTER TABLE chronology.calendar_events
    ADD COLUMN IF NOT EXISTS recurrence_interval INT CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),
    ADD COLUMN IF NOT EXISTS moon_id UUID REFERENCES chronology.calendar_moons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moon_phase NUMERIC(5,2) CHECK (moon_phase IS NULL OR (moon_phase >= 0 AND moon_phase < 100));
