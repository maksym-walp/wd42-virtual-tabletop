-- ================================================================
-- Хронологія: власні назви термінів і ери.
--
--   * calendars.term_day/term_week/term_season/term_year — як цей календар
--     називає «День», «Тиждень», «Сезон», «Рік» (називний відмінок, однина).
--     NULL — стандартна назва.
--   * chronology.calendar_eras — ери понад «основну» (current_era_name /
--     previous_era_name лишаються: ними підписано роки до першої ери).
--     Ера починається в start_year/start_month_id/start_day — це дата в
--     безперервному відліку календаря (рік 1 = початок літочислення), саме в
--     ньому зберігаються всі дати подій, НІП і кампаній. З цієї миті в ері
--     відлік років, місяців, днів місяця й днів тижня йде з 1 наново (лише
--     цикли супутників не перериваються). Ера триває до початку наступної.
--     cycle_years (необов'язково) робить еру циклічною: вона повторюється
--     циклами по cycle_years років, у кожному відлік знову з 1.
-- ================================================================

ALTER TABLE chronology.calendars
    ADD COLUMN IF NOT EXISTS term_day    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS term_week   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS term_season VARCHAR(50),
    ADD COLUMN IF NOT EXISTS term_year   VARCHAR(50);

CREATE TABLE IF NOT EXISTS chronology.calendar_eras (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id    UUID         NOT NULL REFERENCES chronology.calendars(id) ON DELETE CASCADE,
    name           VARCHAR(200) NOT NULL,
    start_year     INT          NOT NULL,
    start_month_id UUID         NOT NULL REFERENCES chronology.calendar_months(id) ON DELETE CASCADE,
    start_day      INT          NOT NULL CHECK (start_day > 0),
    cycle_years    INT          CHECK (cycle_years IS NULL OR cycle_years > 0),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_eras_calendar_id ON chronology.calendar_eras(calendar_id);
