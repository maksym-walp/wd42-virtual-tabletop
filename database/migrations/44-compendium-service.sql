-- ================================================================
-- "compendium" service — NPCs and Bestiary creatures. species/subspecies
-- are shared descriptive references (owned, private by default, same
-- created_by/is_public convention as maps.locations); compendium_entries
-- uses Single Table Inheritance (entity_type discriminator) since npc and
-- creature rows share almost every column, differing only by two nullable
-- npc-only fields (motivation, backstory).
-- Cross-schema owner refs (created_by -> auth.users.id) stay FK-less plain
-- UUID columns, matching the repo convention (see 35-maps-service.sql).
-- ================================================================

CREATE SCHEMA IF NOT EXISTS compendium;

CREATE TABLE IF NOT EXISTS compendium.species (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,              -- auth.users.id, cross-schema, no FK
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_species_created_by ON compendium.species(created_by);
CREATE INDEX IF NOT EXISTS idx_species_is_public  ON compendium.species(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS compendium.subspecies (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id  UUID         NOT NULL REFERENCES compendium.species(id) ON DELETE CASCADE,
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subspecies_species_id ON compendium.subspecies(species_id);
CREATE INDEX IF NOT EXISTS idx_subspecies_created_by ON compendium.subspecies(created_by);
CREATE INDEX IF NOT EXISTS idx_subspecies_is_public  ON compendium.subspecies(is_public) WHERE is_public = true;

-- STI: one table for both npc and creature. NPC-only fields (motivation,
-- backstory) stay nullable and are cleared server-side when entity_type =
-- 'creature'. species/subspecies are descriptive references, not ownership —
-- deleting a species must not wipe entries that used it, hence SET NULL.
CREATE TABLE IF NOT EXISTS compendium.compendium_entries (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(10)  NOT NULL CHECK (entity_type IN ('npc', 'creature')),
    created_by    UUID         NOT NULL,
    name          VARCHAR(200) NOT NULL,
    species_id    UUID         REFERENCES compendium.species(id) ON DELETE SET NULL,
    subspecies_id UUID         REFERENCES compendium.subspecies(id) ON DELETE SET NULL,
    description   TEXT,
    history       TEXT,
    image_url     VARCHAR(500),
    motivation    TEXT,                              -- npc-only
    backstory     TEXT,                               -- npc-only
    dexterity     SMALLINT     NOT NULL CHECK (dexterity BETWEEN 1 AND 6),
    body          SMALLINT     NOT NULL CHECK (body BETWEEN 1 AND 6),
    intelligence  SMALLINT     NOT NULL CHECK (intelligence BETWEEN 1 AND 6),
    wisdom        SMALLINT     NOT NULL CHECK (wisdom BETWEEN 1 AND 6),
    charisma      SMALLINT     NOT NULL CHECK (charisma BETWEEN 1 AND 6),
    is_public     BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_entity_type   ON compendium.compendium_entries(entity_type);
CREATE INDEX IF NOT EXISTS idx_entries_created_by    ON compendium.compendium_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_entries_is_public     ON compendium.compendium_entries(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_entries_species_id    ON compendium.compendium_entries(species_id);
CREATE INDEX IF NOT EXISTS idx_entries_subspecies_id ON compendium.compendium_entries(subspecies_id);
