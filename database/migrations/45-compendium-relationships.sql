-- ================================================================
-- Cross-service associations for compendium entries: equipment loadout,
-- known spells, known maneuvers. Mirrors character_sheet.equipment /
-- .known_spells / .maneuvers — FK+CASCADE on the owning entry_id side,
-- a bare cross-schema UUID on the other, UNIQUE composite to prevent
-- duplicate links.
-- Equipment is split across equipment.items/weapons/armor (see
-- 39-equipment-split-tables.sql) — there is no single "equipment" table,
-- so equipment_id is resolved against all three at read time (same
-- technique as character-sheet's equipment.model.js CATALOG union); no
-- discriminator column is stored here either.
-- ================================================================

CREATE TABLE IF NOT EXISTS compendium.compendium_equipment (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id     UUID        NOT NULL REFERENCES compendium.compendium_entries(id) ON DELETE CASCADE,
    equipment_id UUID        NOT NULL,              -- equipment.items/weapons/armor.id, cross-schema, no FK
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_compendium_equipment_entry_id ON compendium.compendium_equipment(entry_id);

CREATE TABLE IF NOT EXISTS compendium.compendium_spells (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id   UUID        NOT NULL REFERENCES compendium.compendium_entries(id) ON DELETE CASCADE,
    spell_id   UUID        NOT NULL,                -- spellbook.spells.id, cross-schema, no FK
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_compendium_spells_entry_id ON compendium.compendium_spells(entry_id);

CREATE TABLE IF NOT EXISTS compendium.compendium_maneuvers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id    UUID        NOT NULL REFERENCES compendium.compendium_entries(id) ON DELETE CASCADE,
    maneuver_id UUID        NOT NULL,               -- maneuvers.entries.id, cross-schema, no FK
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, maneuver_id)
);

CREATE INDEX IF NOT EXISTS idx_compendium_maneuvers_entry_id ON compendium.compendium_maneuvers(entry_id);
