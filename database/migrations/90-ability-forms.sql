-- ================================================================
-- Форми вмінь + вибір форми у вузлах дерева розвитку.
--
-- abilities.entries — та сама модель форм, що й у заклинань (міграції
-- 81/82): колонки самого рядка — основна форма; forms — додаткові
-- рівневі ('primitive'/'perfected', id = kind) або альтернативні
-- ('alternative', id — uuid, власна назва), не змішуються (перевіряє
-- abilities-сервіс); main_form_name — назва основної форми.
--
-- character_sheet.abilities — освоєння форм персонажем, як у
-- known_spells: form_tier ('primitive'/'full'/'perfected', NULL для
-- вмінь без рівневих форм), primary_form ('main' або id альтернативної),
-- mastered_forms (ключі освоєних форм). Межі перевіряє character-sheet.
--
-- skill_tree.node_grants.form_key — яку форму вміння/заклинання вузол
-- видає чи робить доступною: NULL — усі форми; інакше ключ форми
-- ('main', 'primitive', 'perfected' або id альтернативної). Для
-- колекцій завжди NULL.
-- ================================================================

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS forms JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS main_form_name TEXT;

ALTER TABLE character_sheet.abilities
    ADD COLUMN IF NOT EXISTS form_tier TEXT
        CHECK (form_tier IN ('primitive', 'full', 'perfected')),
    ADD COLUMN IF NOT EXISTS primary_form TEXT NOT NULL DEFAULT 'main',
    ADD COLUMN IF NOT EXISTS mastered_forms TEXT[] NOT NULL DEFAULT '{main}';

ALTER TABLE skill_tree.node_grants
    ADD COLUMN IF NOT EXISTS form_key TEXT;
