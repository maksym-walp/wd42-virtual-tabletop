-- ================================================================
-- Таймер діяльності та відпочинок персонажа (character-sheet, src/rules/).
--
--   rest_timer_hours     — години від останнього повноцінного відпочинку;
--   timer_checks_done    — скільки порогів перевірки Витривалості вже
--                          пройдено (пороги: 12, 18, 24, … годин);
--   timer_checks_passed  — скільки з них успішні (h у складності
--                          D = max(1, h) × (Втома + 1));
--   last_rest            — результат останнього відпочинку (що відновлено,
--                          кидки, хто натиснув), показується обом сторонам.
--
-- Поля таймера змінює лише ГМ кампанії/адмін (POST /timer/advance) або
-- відпочинок (POST /:id/rest); загальний PUT /:id їх відхиляє.
--
-- timer_events — журнал ідемпотентних нарахувань годин: однаковий
-- source_key (напр. combat:<sceneId>) для персонажа враховується один раз.
-- ================================================================

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS rest_timer_hours    NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS timer_checks_done   INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS timer_checks_passed INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_rest           JSONB;

CREATE TABLE IF NOT EXISTS character_sheet.timer_events (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID         NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    source_key   VARCHAR(100) NOT NULL,
    hours        NUMERIC(8,2) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, source_key)
);
