-- ================================================================
-- Factions ("Фракції") — a group entity owned by its creator (same
-- created_by/is_public pattern as species/races), with a symbol image,
-- one-or-more leaders (always NPCs, from this same schema — real FK, not
-- a bare cross-schema UUID) and members (NPCs or player characters, hence
-- a polymorphic member_type + member_id pair; character_sheet.characters
-- lives in a different schema of the same Postgres instance, so member_id
-- for member_type='character' stays a bare UUID, no FK, matching the
-- repo's cross-schema convention).
-- ================================================================

CREATE TABLE IF NOT EXISTS compendium.factions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,              -- auth.users.id, cross-schema, no FK
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    symbol_url  VARCHAR(500),
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factions_created_by ON compendium.factions(created_by);
CREATE INDEX IF NOT EXISTS idx_factions_is_public  ON compendium.factions(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS compendium.faction_leaders (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    faction_id   UUID        NOT NULL REFERENCES compendium.factions(id) ON DELETE CASCADE,
    npc_entry_id UUID        NOT NULL REFERENCES compendium.compendium_entries(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faction_id, npc_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_leaders_faction_id ON compendium.faction_leaders(faction_id);

CREATE TABLE IF NOT EXISTS compendium.faction_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    faction_id  UUID        NOT NULL REFERENCES compendium.factions(id) ON DELETE CASCADE,
    member_type VARCHAR(10) NOT NULL CHECK (member_type IN ('npc', 'character')),
    member_id   UUID        NOT NULL,               -- compendium_entries.id or character_sheet.characters.id, no FK
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faction_id, member_type, member_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_members_faction_id ON compendium.faction_members(faction_id);

-- ================================================================
-- NPC-only biographical fields: age, gender, birth date. Birth date is
-- expressed against one of the user's chronology calendars (own or public,
-- same visibility chronology.findAll already grants) — calendar_id and
-- month_id are bare cross-schema UUIDs into chronology.calendars/
-- chronology.calendar_months, no FK, same reasoning as faction member_id
-- above. All nullable and cleared server-side for entity_type='creature',
-- mirroring motivation/backstory/faction.
-- ================================================================

ALTER TABLE compendium.compendium_entries
    ADD COLUMN IF NOT EXISTS age               SMALLINT CHECK (age IS NULL OR age >= 0),
    ADD COLUMN IF NOT EXISTS gender             VARCHAR(20) CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')),
    ADD COLUMN IF NOT EXISTS birth_calendar_id  UUID,
    ADD COLUMN IF NOT EXISTS birth_year         INTEGER,
    ADD COLUMN IF NOT EXISTS birth_month_id     UUID,
    ADD COLUMN IF NOT EXISTS birth_day          SMALLINT;
