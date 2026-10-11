-- ================================================================
-- «Природа заклинання» → «Форма магії».
--
-- Колонка spellbook.spells.nature (і query-параметр ?nature=) лишаються
-- як є — змінюється лише набір значень і відображення:
--   * 'infernal' (Інфернальна) мігрує в 'pact' (Пакт);
--   * з'являється 'nature' (Природа);
--   * 'elemental' тепер «Стихії», 'integral' — «Інтеграл».
-- Набір ключів фіксований (CHECK), адмін редагує лише назви й описи —
-- вони живуть в admin.site_configs (ключ magic_forms) і читаються
-- spellbook-сервісом (GET /magic-forms), як і види заклинань (83).
-- ================================================================

ALTER TABLE spellbook.spells DROP CONSTRAINT IF EXISTS spells_nature_check;

-- infernal → pact зі збереженням порядку й без дублікатів (запис міг
-- мати і infernal, і pact одночасно).
UPDATE spellbook.spells s
SET nature = ARRAY(
    SELECT v FROM (
        SELECT DISTINCT ON (v) v, ord
        FROM (
            SELECT CASE WHEN n = 'infernal' THEN 'pact' ELSE n END AS v, ord
            FROM unnest(s.nature) WITH ORDINALITY AS t(n, ord)
        ) mapped
        ORDER BY v, ord
    ) deduped
    ORDER BY ord
)
WHERE 'infernal' = ANY(nature);

ALTER TABLE spellbook.spells
    ADD CONSTRAINT spells_nature_check
    CHECK (nature <@ ARRAY['arcana','elemental','integral','pact','nature','blight']::text[]);

INSERT INTO admin.site_configs (key, value) VALUES
    ('magic_forms', '[
        {"key":"arcana","label":"Аркана","description":""},
        {"key":"elemental","label":"Стихії","description":""},
        {"key":"integral","label":"Інтеграл","description":""},
        {"key":"pact","label":"Пакт","description":""},
        {"key":"nature","label":"Природа","description":""},
        {"key":"blight","label":"Скверна","description":""}
    ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
