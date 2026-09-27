-- ================================================================
-- Заклинання: рівні (міграція 79) замінюються формами; «Потрібно
-- вивчити»/«Похідні» (міграція 80) прибираються.
--
-- Колонки самого рядка spellbook.spells — це основна форма. Якщо в
-- заклинання є рівневі форми, основна форма показується як «Повноцінна».
-- spellbook.spells.forms — додаткові форми, кожна — повний знімок полів,
-- що можуть відрізнятися між формами (див. normalizeForms у
-- services/spellbook/src/models/spell.model.js), плюс:
--   kind — 'primitive' (Примітивна), 'perfected' (Довершена) —
--          рівневі, не більше однієї кожного виду; або 'alternative' —
--          альтернативна форма з власною назвою, скільки завгодно;
--   id   — стабільний ключ форми: для рівневих збігається з kind, для
--          альтернативних — uuid (на нього посилається лист персонажа);
--   name — назва альтернативної форми.
--
-- character_sheet.known_spells:
--   form_tier      — до якої рівневої форми дійшов персонаж ('primitive'/
--                    'full'/'perfected'); NULL для заклинань без рівневих форм;
--   primary_form   — ключ форми, яку персонаж обрав основною для себе
--                    ('main' — основна форма заклинання, або id альтернативної);
--   mastered_forms — ключі освоєних форм ('main' та/або id альтернативних).
-- Межі перевіряє character-sheet при записі.
-- ================================================================

ALTER TABLE spellbook.spells
    ADD COLUMN IF NOT EXISTS forms JSONB NOT NULL DEFAULT '[]';

-- Наявні рівні 2..N переїжджають в альтернативні форми «Рівень N».
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'spellbook' AND table_name = 'spells' AND column_name = 'levels') THEN
    UPDATE spellbook.spells s
    SET forms = (
      SELECT COALESCE(jsonb_agg(
               lv.value || jsonb_build_object(
                 'id', gen_random_uuid()::text,
                 'kind', 'alternative',
                 'name', 'Рівень ' || (lv.ordinality + 1)
               ) ORDER BY lv.ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(s.levels) WITH ORDINALITY AS lv(value, ordinality)
    )
    WHERE jsonb_array_length(s.levels) > 0 AND s.forms = '[]'::jsonb;
  END IF;
END $$;

ALTER TABLE spellbook.spells DROP COLUMN IF EXISTS levels;

DROP INDEX IF EXISTS spellbook.idx_spells_parent;
ALTER TABLE spellbook.spells DROP COLUMN IF EXISTS parent_spell_id;

ALTER TABLE character_sheet.known_spells
    DROP COLUMN IF EXISTS level,
    ADD COLUMN IF NOT EXISTS form_tier TEXT
        CHECK (form_tier IN ('primitive', 'full', 'perfected')),
    ADD COLUMN IF NOT EXISTS primary_form TEXT NOT NULL DEFAULT 'main',
    ADD COLUMN IF NOT EXISTS mastered_forms TEXT[] NOT NULL DEFAULT '{main}';
