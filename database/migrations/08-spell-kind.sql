-- ================================================================
-- Migration: spell_kind (ranged/melee/defensive/healing/utility/combined)
-- Backend model/frontend already read & write this column; it was
-- never added to any init/migration script.
-- ================================================================

ALTER TABLE spellbook.spells
  ADD COLUMN IF NOT EXISTS spell_kind VARCHAR(20) NOT NULL DEFAULT 'utility'
    CHECK (spell_kind IN ('ranged','melee','defensive','healing','utility','combined'));

CREATE INDEX IF NOT EXISTS idx_spells_kind ON spellbook.spells(spell_kind);
