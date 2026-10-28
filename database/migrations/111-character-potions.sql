-- ================================================================
-- Зілля в інвентарі персонажа і звикання до них (character-sheet,
-- src/rules/potions.js).
--
-- character_sheet.equipment (для рядків-зіль; решта видів їх ігнорує):
--   containers     — скільки повних (запечатаних) ємностей;
--   open_portions  — скільки порцій лишилось у відкритій ємності.
--
-- character_sheet.characters — звикання до зілля:
--   potion_habit_rank       — скільки кидків звикання вже зроблено (наступний
--                             кубик — d4, d6, d8, d10, d12, d20, d100);
--   potion_habituated       — персонаж звик: ефект наступних порцій удвічі менший;
--   potion_excess_portions  — порції, випиті після звикання (складність
--                             перевірки Імунітету).
-- Перепочинок знижує ранг на 1, повноцінний/довготривалий відпочинок скидає все.
-- ================================================================

ALTER TABLE character_sheet.equipment
    ADD COLUMN IF NOT EXISTS containers    SMALLINT NOT NULL DEFAULT 1 CHECK (containers >= 0),
    ADD COLUMN IF NOT EXISTS open_portions SMALLINT NOT NULL DEFAULT 0 CHECK (open_portions >= 0);

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS potion_habit_rank      SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS potion_habituated      BOOLEAN  NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS potion_excess_portions INT      NOT NULL DEFAULT 0;
