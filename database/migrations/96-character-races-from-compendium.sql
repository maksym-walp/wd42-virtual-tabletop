-- ================================================================
-- Раса персонажа — публічна раса компендіуму (compendium.races), а не
-- фіксований ключ. Які раси доступні гравцям, їхня механіка (бонус до
-- характеристики / до пулу очок) і підвиди (народи з бонусами до навичок)
-- налаштовує адмін в admin.site_configs, ключ character_races:
--   [{ race_id, bonus_characteristic, bonus_budget,
--      peoples: [{ people_id, skill_bonuses: [{ skill, value }] }] }]
-- Цей конфіг замінює character_peoples з міграції 95 (там підвиди були
-- прив'язані до старих ключів рас).
--
--   * compendium.races.image_url — зображення, що показує картка раси на
--     кроці 1 створення персонажа;
--   * character_sheet.characters.race_id — раса компендіуму (голий UUID без
--     FK, як і people_id). Старе поле race стає необов'язковим і лишається
--     для персонажів, яких не вдалося зіставити з расою: інтерфейс показує
--     назву раси з компендіуму, а за її відсутності — старий ключ.
-- ================================================================

ALTER TABLE compendium.races
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS race_id UUID;

ALTER TABLE character_sheet.characters
    ALTER COLUMN race DROP NOT NULL;

-- CHECK на race має автогенероване імʼя — шукаємо за визначенням, як у 92.
DO $$
DECLARE con RECORD;
BEGIN
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'character_sheet.characters'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%race%'
    LOOP
        EXECUTE format('ALTER TABLE character_sheet.characters DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_characters_race_id ON character_sheet.characters(race_id);

-- Старі ключі рас → публічна раса компендіуму з тією ж назвою (якщо є).
-- Колонки: ключ, назва в компендіумі, характеристика з бонусом (+1 до 4
-- навичок, стартово 2 замість 1), додаткові очки пулу — як було в константах.
CREATE TEMP TABLE legacy_races (key text, label text, bonus_characteristic text, bonus_budget int);
INSERT INTO legacy_races VALUES
    ('human',    'Люди',          'agility',   0),
    ('gnome',    'Гноми',         'wisdom',    0),
    ('dwarf',    'Дворфи',        'physique',  0),
    ('elf',      'Ельфи',         'intellect', 0),
    ('sangvi',   'Санґви',        NULL,        4),
    ('nephilim', 'Нефіліми',      'charisma',  0),
    ('other',    'Інший народ',   NULL,        0);

CREATE TEMP TABLE legacy_race_match AS
SELECT DISTINCT ON (l.key) l.key, l.bonus_characteristic, l.bonus_budget, r.id AS race_id
FROM legacy_races l
JOIN compendium.races r ON r.is_public = true AND lower(r.name) = lower(l.label)
ORDER BY l.key, r.created_at;

UPDATE character_sheet.characters c
SET race_id = m.race_id
FROM legacy_race_match m
WHERE c.race = m.key AND c.race_id IS NULL;

-- Початковий конфіг: знайдені раси з їхньою колишньою механікою, без підвидів.
-- Якщо відповідних рас у компендіумі немає — конфіг порожній, адмін додає раси сам.
DELETE FROM admin.site_configs WHERE key = 'character_peoples';

INSERT INTO admin.site_configs (key, value)
SELECT 'character_races',
       COALESCE(jsonb_agg(jsonb_build_object(
           'race_id', race_id,
           'bonus_characteristic', bonus_characteristic,
           'bonus_budget', bonus_budget,
           'peoples', '[]'::jsonb
       )), '[]'::jsonb)
FROM legacy_race_match
ON CONFLICT (key) DO NOTHING;

DROP TABLE legacy_race_match;
DROP TABLE legacy_races;
