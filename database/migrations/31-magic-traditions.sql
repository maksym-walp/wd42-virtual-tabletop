-- ================================================================
-- Магічні традиції: глобальний довідник шкіл/традицій магії — без
-- поділу на канонічні/спільнотні (на відміну від заклинань і
-- колекцій): усі традиції видимі й редагуються спільно.
-- creator_id зберігається лише для довідки (хто створив запис), не
-- для контролю доступу — керувати самими традиціями (POST/PUT/DELETE)
-- можуть лише admin/game_master (requireCanonicalManager).
--
-- tradition_spells: М:М — заклинання може належати кільком традиціям.
-- Прив'язку свого заклинання до вже існуючої традиції може редагувати
-- власник заклинання (або admin) — це частина редагування ЙОГО
-- заклинання, а не керування самою традицією.
-- ================================================================

CREATE TABLE IF NOT EXISTS spellbook.traditions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    description  TEXT,
    founders     TEXT,
    creator_id   UUID        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spellbook.tradition_spells (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tradition_id UUID        NOT NULL REFERENCES spellbook.traditions(id) ON DELETE CASCADE,
    spell_id     UUID        NOT NULL REFERENCES spellbook.spells(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tradition_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_tradition_spells_spell_id ON spellbook.tradition_spells (spell_id);
