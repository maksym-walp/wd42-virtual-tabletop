-- ================================================================
-- Підвид (народ) персонажа — необовʼязковий вибір після раси.
--
--   * people_id — compendium.peoples.id (голий UUID без FK, як і решта
--     міжсхемних посилань на компендіум). Яка раса персонажа якими
--     народами може обиратися й що народ дає — налаштовує адмін у
--     admin.site_configs, ключ character_peoples:
--       [{ people_id, race, skill_bonuses: [{ skill, value }] }]
--   * people_bonus — знімок бонусів до навичок, застосованих саме цьому
--     персонажу ({ skill_key: n }). Зміна/зняття підвиду віднімає знімок,
--     а не поточний конфіг, тож правки адміна не ламають уже створених
--     персонажів.
-- ================================================================

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS people_id    UUID,
    ADD COLUMN IF NOT EXISTS people_bonus JSONB NOT NULL DEFAULT '{}';

INSERT INTO admin.site_configs (key, value)
VALUES ('character_peoples', '[]')
ON CONFLICT (key) DO NOTHING;
