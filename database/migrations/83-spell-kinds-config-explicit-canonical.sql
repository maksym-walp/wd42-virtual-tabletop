-- ================================================================
-- Дві незалежні зміни, застосовані разом:
--
-- 1. Види заклинань (spell_kind) переїжджають у admin.site_configs
--    (ключ spell_kinds) і редагуються з адмін-панелі — так само, як
--    типи/особливості зброї в 55-weapon-grip-multi-and-admin-configs.sql.
--    CHECK-обмеження знімається, бо фіксований список більше не
--    відповідає дійсності. Початкові значення — ті самі, що були
--    захардкожені в constants/spellbook.js.
--
-- 2. Канонічність стає явним прапорцем. Раніше статус рахувався як
--    (роль автора IN admin/game_master) OR is_canonical, тож запис
--    майстра чи адміна неможливо було зробити неканонічним — кнопка
--    "Зняти позначку" скидала лише прапорець. Тепер джерело правди —
--    лише колонка is_canonical; наявні записи майстрів/адмінів
--    отримують is_canonical = true, щоб нічого не змінилося візуально.
-- ================================================================

ALTER TABLE spellbook.spells DROP CONSTRAINT IF EXISTS spells_spell_kind_check;
ALTER TABLE spellbook.spells ALTER COLUMN spell_kind TYPE VARCHAR(50);

INSERT INTO admin.site_configs (key, value) VALUES
    ('spell_kinds', '[
        {"key":"ranged","label":"Дальнобійне"},
        {"key":"melee","label":"Ближнє"},
        {"key":"defensive","label":"Захисне"},
        {"key":"healing","label":"Лікуюче"},
        {"key":"utility","label":"Небойове"},
        {"key":"combined","label":"Комбіноване"}
    ]'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'spellbook.spells', 'spellbook.collections',
    'abilities.entries', 'abilities.collections',
    'equipment.items', 'equipment.weapons', 'equipment.armor', 'equipment.artifacts',
    'equipment.collections'
  ] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE %s SET is_canonical = true
         WHERE NOT is_canonical
           AND user_id IN (SELECT id FROM auth.users WHERE role IN (''admin'', ''game_master''))',
        t
      );
    END IF;
  END LOOP;
END $$;
