-- ================================================================
-- Заклинання: "Тип магії" → "Природа" (nature, множинне значення),
-- лорне поле "Творець" (lore_creator, не пов'язане з user_id автора
-- запису), та компоненти як структуровані об'єкти з посиланням на
-- предмети екіпіювання (equipment.items).
-- ================================================================

-- 1) magic_type (single) → nature (text[])
ALTER TABLE spellbook.spells ADD COLUMN IF NOT EXISTS nature TEXT[] NOT NULL DEFAULT '{}';
UPDATE spellbook.spells SET nature = ARRAY[magic_type] WHERE nature = '{}';
ALTER TABLE spellbook.spells ADD CONSTRAINT spells_nature_check
  CHECK (nature <@ ARRAY['arcana','elemental','integral','infernal','blight']::text[]);
ALTER TABLE spellbook.spells DROP COLUMN IF EXISTS magic_type;
CREATE INDEX IF NOT EXISTS idx_spells_nature ON spellbook.spells USING GIN (nature);

-- 2) lore_creator (Творець) — суто лорне поле, не user_id автора запису
ALTER TABLE spellbook.spells ADD COLUMN IF NOT EXISTS lore_creator TEXT;

-- 3) components: TEXT[] → JSONB масив об'єктів { item_id, name, quantity, unit }
ALTER TABLE spellbook.spells ADD COLUMN IF NOT EXISTS components_v2 JSONB NOT NULL DEFAULT '[]';
UPDATE spellbook.spells
SET components_v2 = (
  SELECT jsonb_agg(jsonb_build_object('item_id', NULL, 'name', c, 'quantity', 1, 'unit', 'шт.'))
  FROM unnest(components) AS c
)
WHERE components IS NOT NULL AND array_length(components, 1) > 0;
ALTER TABLE spellbook.spells DROP COLUMN IF EXISTS components;
ALTER TABLE spellbook.spells RENAME COLUMN components_v2 TO components;
