-- ================================================================
-- Рівноцінні / альтернативні заклинання та вміння — посилання на
-- інший, самостійно заповнений запис того самого каталогу (замість
-- колишніх вбудованих альтернативних форм, міграція 117).
--
-- Внутрішньосервісне посилання (обидві сторони — той самий каталог),
-- тож, на відміну від голих cross-service uuid деінде в проєкті, тут
-- можна (і треба) справжній FK з ON DELETE CASCADE.
--
-- Зберігається один рядок на пару (напрямок довільний, зв'язок
-- симетричний за змістом); читається запитом з обох боків
-- (spell_id = $1 OR related_spell_id = $1), щоб показати посилання на
-- сторінках обох заклинань без подвійного запису.
--
-- Посилання не надає доступу — traditions/complexity зв'язаного
-- запису перевіряються окремо (character-sheet/spell-access.model.js).
-- ================================================================

CREATE TABLE IF NOT EXISTS spellbook.related_spells (
    spell_id         UUID        NOT NULL REFERENCES spellbook.spells(id) ON DELETE CASCADE,
    related_spell_id UUID        NOT NULL REFERENCES spellbook.spells(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (spell_id, related_spell_id),
    CHECK (spell_id <> related_spell_id)
);
CREATE INDEX IF NOT EXISTS idx_related_spells_reverse ON spellbook.related_spells (related_spell_id);

CREATE TABLE IF NOT EXISTS abilities.related_entries (
    entry_id         UUID        NOT NULL REFERENCES abilities.entries(id) ON DELETE CASCADE,
    related_entry_id UUID        NOT NULL REFERENCES abilities.entries(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entry_id, related_entry_id),
    CHECK (entry_id <> related_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_related_entries_reverse ON abilities.related_entries (related_entry_id);
