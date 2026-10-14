-- ================================================================
-- Хронологія: календар за замовчуванням і відображення тривалих подій.
--
--   * chronology.calendars.is_default — календар, який адмін позначає
--     «основним»: у всіх вибірах дати в інших сервісах (дата народження/смерті
--     НІП, привʼязка календаря до кампанії, додавання НІП до події) саме він
--     обраний наперед. Не більше одного — частковий унікальний індекс.
--   * chronology.calendar_events.duration_display — як тривала подія (з
--     датою завершення) малюється на сітці календаря:
--       start      — лише в день початку (поведінка до цієї міграції);
--       start_end  — у день початку й у день завершення;
--       every_day  — позначка в кожен день тривалості;
--       none       — на сітці не показувати (лишається у списку «Події»).
-- ================================================================

ALTER TABLE chronology.calendars
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendars_single_default
    ON chronology.calendars ((true)) WHERE is_default;

ALTER TABLE chronology.calendar_events
    ADD COLUMN IF NOT EXISTS duration_display VARCHAR(12) NOT NULL DEFAULT 'start'
        CHECK (duration_display IN ('start', 'start_end', 'every_day', 'none'));
