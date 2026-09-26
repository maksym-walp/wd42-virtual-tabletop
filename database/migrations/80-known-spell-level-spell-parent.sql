-- ================================================================
-- 1. character_sheet.known_spells.level — яким рівнем заклинання
--    (див. spellbook.spells.levels, міграція 79) уже оволодів персонаж.
--    1 = базовий рівень (колонки самого заклинання); N > 1 =
--    spells.levels[N - 2]. Межі перевіряє character-sheet при записі.
--
-- 2. spellbook.spells.parent_spell_id — «Потрібно вивчити»: заклинання,
--    з якого походить це. Максимум одне батьківське; «Похідні заклинання»
--    не зберігаються окремо, а обчислюються як ті, чий parent_spell_id
--    вказує на це заклинання. Цикли відсікає spellbook при записі.
--    ON DELETE SET NULL: видалення батька лише відчіплює похідні.
-- ================================================================

ALTER TABLE character_sheet.known_spells
    ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1 CHECK (level >= 1);

ALTER TABLE spellbook.spells
    ADD COLUMN IF NOT EXISTS parent_spell_id UUID
        REFERENCES spellbook.spells(id) ON DELETE SET NULL
        CHECK (parent_spell_id <> id);

CREATE INDEX IF NOT EXISTS idx_spells_parent ON spellbook.spells(parent_spell_id);
