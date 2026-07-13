-- ================================================================
-- Migration: split "маневри" and "вміння" back into separate services
--   - Maneuvers stay fighter-only; the category column added in
--     migration 17 is reverted.
--   - New "abilities" service (вміння) — its own catalog, usable by
--     any combination of archetypes via an `archetypes` array set by
--     checkboxes at creation time. Mirrors the equipment/maneuvers
--     catalog + character_sheet reference-table pattern.
-- ================================================================

-- Dropping the column also drops its index (idx_maneuvers_entries_category);
-- Postgres cascades that automatically since the index can't exist without it.
ALTER TABLE maneuvers.entries DROP COLUMN IF EXISTS category;

CREATE SCHEMA IF NOT EXISTS abilities;

CREATE TABLE IF NOT EXISTS abilities.entries (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    archetypes  TEXT[]       NOT NULL DEFAULT '{}',
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abilities_entries_user_id    ON abilities.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_abilities_entries_public     ON abilities.entries(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_abilities_entries_archetypes ON abilities.entries USING GIN (archetypes);

CREATE TABLE IF NOT EXISTS character_sheet.abilities (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    ability_id   UUID NOT NULL,
    UNIQUE (character_id, ability_id)
);

CREATE INDEX IF NOT EXISTS idx_cs_abilities_ability_id ON character_sheet.abilities(ability_id);
