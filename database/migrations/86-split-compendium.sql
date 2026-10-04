-- ================================================================
-- Split the compendium service into three services:
--   compendium — the lore wiki: species/subspecies/races/peoples (stays).
--   bestiary   — creatures (new schema `bestiary`).
--   npcs       — NPCs and factions (new schema `npcs`).
--
-- compendium.compendium_entries (STI on entity_type) is split into
-- bestiary.creatures and npcs.npcs. Row ids are preserved, so every bare
-- cross-schema UUID that points at an entry keeps working untouched:
-- campaigns.combatants.compendium_entry_id, spellbook.spells /
-- abilities.entries.lore_creator_npc_id, chronology.calendar_event_participants.entry_id.
--
-- Taxonomy refs (species_id/subspecies_id/race_id/people_id) become bare
-- cross-schema UUIDs — the old ON DELETE SET NULL is kept by triggers on the
-- compendium taxonomy tables (see the end of this file).
--
-- Also new on NPCs: death date (same shape as the birth date), directed
-- relationships to other NPCs/player characters, and a `role` on faction
-- membership. The free-text `faction` column goes away: an exact name match
-- against one visible faction becomes a real membership, anything else is
-- kept in private_notes.
-- ================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS bestiary;
CREATE SCHEMA IF NOT EXISTS npcs;

-- ---------------------------------------------------------------- bestiary

CREATE TABLE IF NOT EXISTS bestiary.creatures (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by          UUID         NOT NULL,              -- auth.users.id, cross-schema, no FK
    name                VARCHAR(200) NOT NULL,
    species_id          UUID,                               -- compendium.species.id, no FK
    subspecies_id       UUID,                               -- compendium.subspecies.id, no FK
    race_id             UUID,                               -- compendium.races.id, no FK
    people_id           UUID,                               -- compendium.peoples.id, no FK
    description         TEXT,
    history             TEXT,                               -- "Походження"
    image_url           VARCHAR(500),
    image_crop          JSONB,
    dexterity           SMALLINT     NOT NULL CHECK (dexterity BETWEEN 1 AND 6),
    body                SMALLINT     NOT NULL CHECK (body BETWEEN 1 AND 6),
    intelligence        SMALLINT     NOT NULL CHECK (intelligence BETWEEN 1 AND 6),
    wisdom              SMALLINT     NOT NULL CHECK (wisdom BETWEEN 1 AND 6),
    charisma            SMALLINT     NOT NULL CHECK (charisma BETWEEN 1 AND 6),
    health_die_override VARCHAR(3)   CHECK (health_die_override IS NULL OR health_die_override IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
    is_public           BOOLEAN      NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creatures_created_by    ON bestiary.creatures(created_by);
CREATE INDEX IF NOT EXISTS idx_creatures_is_public     ON bestiary.creatures(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_creatures_species_id    ON bestiary.creatures(species_id);
CREATE INDEX IF NOT EXISTS idx_creatures_subspecies_id ON bestiary.creatures(subspecies_id);
CREATE INDEX IF NOT EXISTS idx_creatures_race_id       ON bestiary.creatures(race_id);
CREATE INDEX IF NOT EXISTS idx_creatures_people_id     ON bestiary.creatures(people_id);

INSERT INTO bestiary.creatures
    (id, created_by, name, species_id, subspecies_id, race_id, people_id, description, history,
     image_url, image_crop, dexterity, body, intelligence, wisdom, charisma, health_die_override,
     is_public, created_at, updated_at)
SELECT id, created_by, name, species_id, subspecies_id, race_id, people_id, description, history,
       image_url, image_crop, dexterity, body, intelligence, wisdom, charisma, health_die_override,
       is_public, created_at, updated_at
FROM compendium.compendium_entries
WHERE entity_type = 'creature';

CREATE TABLE IF NOT EXISTS bestiary.creature_equipment (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creature_id  UUID        NOT NULL REFERENCES bestiary.creatures(id) ON DELETE CASCADE,
    equipment_id UUID        NOT NULL,              -- equipment.items/weapons/armor.id, no FK
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creature_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS idx_creature_equipment_creature_id ON bestiary.creature_equipment(creature_id);

CREATE TABLE IF NOT EXISTS bestiary.creature_spells (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creature_id UUID        NOT NULL REFERENCES bestiary.creatures(id) ON DELETE CASCADE,
    spell_id    UUID        NOT NULL,               -- spellbook.spells.id, no FK
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creature_id, spell_id)
);
CREATE INDEX IF NOT EXISTS idx_creature_spells_creature_id ON bestiary.creature_spells(creature_id);

CREATE TABLE IF NOT EXISTS bestiary.creature_abilities (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creature_id UUID        NOT NULL REFERENCES bestiary.creatures(id) ON DELETE CASCADE,
    ability_id  UUID        NOT NULL,               -- abilities.entries.id, no FK
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creature_id, ability_id)
);
CREATE INDEX IF NOT EXISTS idx_creature_abilities_creature_id ON bestiary.creature_abilities(creature_id);

INSERT INTO bestiary.creature_equipment (id, creature_id, equipment_id, created_at)
SELECT r.id, r.entry_id, r.equipment_id, r.created_at
FROM compendium.compendium_equipment r JOIN bestiary.creatures c ON c.id = r.entry_id;

INSERT INTO bestiary.creature_spells (id, creature_id, spell_id, created_at)
SELECT r.id, r.entry_id, r.spell_id, r.created_at
FROM compendium.compendium_spells r JOIN bestiary.creatures c ON c.id = r.entry_id;

INSERT INTO bestiary.creature_abilities (id, creature_id, ability_id, created_at)
SELECT r.id, r.entry_id, r.ability_id, r.created_at
FROM compendium.compendium_abilities r JOIN bestiary.creatures c ON c.id = r.entry_id;

CREATE TABLE IF NOT EXISTS bestiary.collections (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    image_crop  JSONB,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bestiary_collections_created_by ON bestiary.collections(created_by);
CREATE INDEX IF NOT EXISTS idx_bestiary_collections_is_public  ON bestiary.collections(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS bestiary.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES bestiary.collections(id) ON DELETE CASCADE,
    creature_id   UUID        NOT NULL REFERENCES bestiary.creatures(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, creature_id)
);
CREATE INDEX IF NOT EXISTS idx_bestiary_collection_items_collection_id ON bestiary.collection_items(collection_id);

-- ---------------------------------------------------------------- npcs

CREATE TABLE IF NOT EXISTS npcs.npcs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by          UUID         NOT NULL,              -- auth.users.id, cross-schema, no FK
    name                VARCHAR(200) NOT NULL,
    species_id          UUID,                               -- compendium.species.id, no FK
    subspecies_id       UUID,                               -- compendium.subspecies.id, no FK
    race_id             UUID,                               -- compendium.races.id, no FK
    people_id           UUID,                               -- compendium.peoples.id, no FK
    description         TEXT,
    motivation          TEXT,
    backstory           TEXT,
    image_url           VARCHAR(500),
    image_crop          JSONB,
    dexterity           SMALLINT     NOT NULL CHECK (dexterity BETWEEN 1 AND 6),
    body                SMALLINT     NOT NULL CHECK (body BETWEEN 1 AND 6),
    intelligence        SMALLINT     NOT NULL CHECK (intelligence BETWEEN 1 AND 6),
    wisdom              SMALLINT     NOT NULL CHECK (wisdom BETWEEN 1 AND 6),
    charisma            SMALLINT     NOT NULL CHECK (charisma BETWEEN 1 AND 6),
    health_die_override VARCHAR(3)   CHECK (health_die_override IS NULL OR health_die_override IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
    rolled_health       SMALLINT     CHECK (rolled_health IS NULL OR rolled_health >= 1),
    age                 SMALLINT     CHECK (age IS NULL OR age >= 0),
    gender              VARCHAR(20)  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')),
    -- Birth/death dates against a chronology calendar: bare cross-schema
    -- UUIDs into chronology.calendars / chronology.calendar_months, no FK.
    birth_calendar_id   UUID,
    birth_year          INTEGER,
    birth_month_id      UUID,
    birth_day           SMALLINT     CHECK (birth_day IS NULL OR birth_day >= 1),
    death_calendar_id   UUID,
    death_year          INTEGER,
    death_month_id      UUID,
    death_day           SMALLINT     CHECK (death_day IS NULL OR death_day >= 1),
    private_notes       TEXT,
    is_public           BOOLEAN      NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npcs_created_by    ON npcs.npcs(created_by);
CREATE INDEX IF NOT EXISTS idx_npcs_is_public     ON npcs.npcs(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_npcs_species_id    ON npcs.npcs(species_id);
CREATE INDEX IF NOT EXISTS idx_npcs_subspecies_id ON npcs.npcs(subspecies_id);
CREATE INDEX IF NOT EXISTS idx_npcs_race_id       ON npcs.npcs(race_id);
CREATE INDEX IF NOT EXISTS idx_npcs_people_id     ON npcs.npcs(people_id);

INSERT INTO npcs.npcs
    (id, created_by, name, species_id, subspecies_id, race_id, people_id, description, motivation, backstory,
     image_url, image_crop, dexterity, body, intelligence, wisdom, charisma, health_die_override, rolled_health,
     age, gender, birth_calendar_id, birth_year, birth_month_id, birth_day, private_notes,
     is_public, created_at, updated_at)
SELECT id, created_by, name, species_id, subspecies_id, race_id, people_id, description, motivation, backstory,
       image_url, image_crop, dexterity, body, intelligence, wisdom, charisma, health_die_override, rolled_health,
       age, gender, birth_calendar_id, birth_year, birth_month_id,
       CASE WHEN birth_day >= 1 THEN birth_day END,
       private_notes, is_public, created_at, updated_at
FROM compendium.compendium_entries
WHERE entity_type = 'npc';

CREATE TABLE IF NOT EXISTS npcs.npc_equipment (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id       UUID        NOT NULL REFERENCES npcs.npcs(id) ON DELETE CASCADE,
    equipment_id UUID        NOT NULL,              -- equipment.items/weapons/armor.id, no FK
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (npc_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_equipment_npc_id ON npcs.npc_equipment(npc_id);

CREATE TABLE IF NOT EXISTS npcs.npc_spells (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id     UUID        NOT NULL REFERENCES npcs.npcs(id) ON DELETE CASCADE,
    spell_id   UUID        NOT NULL,                -- spellbook.spells.id, no FK
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (npc_id, spell_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_spells_npc_id ON npcs.npc_spells(npc_id);

CREATE TABLE IF NOT EXISTS npcs.npc_abilities (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id     UUID        NOT NULL REFERENCES npcs.npcs(id) ON DELETE CASCADE,
    ability_id UUID        NOT NULL,                -- abilities.entries.id, no FK
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (npc_id, ability_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_abilities_npc_id ON npcs.npc_abilities(npc_id);

INSERT INTO npcs.npc_equipment (id, npc_id, equipment_id, created_at)
SELECT r.id, r.entry_id, r.equipment_id, r.created_at
FROM compendium.compendium_equipment r JOIN npcs.npcs n ON n.id = r.entry_id;

INSERT INTO npcs.npc_spells (id, npc_id, spell_id, created_at)
SELECT r.id, r.entry_id, r.spell_id, r.created_at
FROM compendium.compendium_spells r JOIN npcs.npcs n ON n.id = r.entry_id;

INSERT INTO npcs.npc_abilities (id, npc_id, ability_id, created_at)
SELECT r.id, r.entry_id, r.ability_id, r.created_at
FROM compendium.compendium_abilities r JOIN npcs.npcs n ON n.id = r.entry_id;

-- Factions move wholesale (ids, indexes and constraints travel with SET SCHEMA).
ALTER TABLE compendium.factions        SET SCHEMA npcs;
ALTER TABLE compendium.faction_leaders SET SCHEMA npcs;
ALTER TABLE compendium.faction_members SET SCHEMA npcs;

DELETE FROM npcs.faction_leaders l WHERE NOT EXISTS (SELECT 1 FROM npcs.npcs n WHERE n.id = l.npc_entry_id);
ALTER TABLE npcs.faction_leaders
    DROP CONSTRAINT IF EXISTS faction_leaders_npc_entry_id_fkey,
    ADD CONSTRAINT faction_leaders_npc_entry_id_fkey
        FOREIGN KEY (npc_entry_id) REFERENCES npcs.npcs(id) ON DELETE CASCADE;

-- member_id stays polymorphic (npc or character_sheet.characters), so no FK;
-- drop NPC members whose entry is gone (nothing cleaned them up before).
DELETE FROM npcs.faction_members m
WHERE m.member_type = 'npc' AND NOT EXISTS (SELECT 1 FROM npcs.npcs n WHERE n.id = m.member_id);

ALTER TABLE npcs.faction_members ADD COLUMN IF NOT EXISTS role VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_faction_members_member ON npcs.faction_members(member_type, member_id);

-- Free-text `faction` -> real membership when it names exactly one faction
-- the NPC's author can see; otherwise the text is preserved in private_notes.
WITH candidates AS (
    SELECT n.id AS npc_id, f.id AS faction_id, count(*) OVER (PARTITION BY n.id) AS matches
    FROM npcs.npcs n
    JOIN compendium.compendium_entries e ON e.id = n.id
    JOIN npcs.factions f
      ON lower(trim(f.name)) = lower(trim(e.faction))
     AND (f.created_by = n.created_by OR f.is_public)
    WHERE nullif(trim(e.faction), '') IS NOT NULL
)
INSERT INTO npcs.faction_members (faction_id, member_type, member_id)
SELECT faction_id, 'npc', npc_id FROM candidates WHERE matches = 1
ON CONFLICT (faction_id, member_type, member_id) DO NOTHING;

UPDATE npcs.npcs n
SET private_notes = concat_ws('', n.private_notes,
        '<p>Фракція: ' || replace(replace(replace(trim(e.faction), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>')
FROM compendium.compendium_entries e
WHERE e.id = n.id
  AND nullif(trim(e.faction), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM npcs.faction_members m JOIN npcs.factions f ON f.id = m.faction_id
      WHERE m.member_type = 'npc' AND m.member_id = n.id
        AND lower(trim(f.name)) = lower(trim(e.faction))
  );

-- Directed relationships: "target is <label> to npc_id" (Bob — брат). The target may be
-- another NPC or a player character (character_sheet.characters, no FK —
-- polymorphic like faction_members); NPC targets are cleaned up by the
-- service on NPC delete.
CREATE TABLE IF NOT EXISTS npcs.npc_relationships (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id      UUID         NOT NULL REFERENCES npcs.npcs(id) ON DELETE CASCADE,
    target_type VARCHAR(10)  NOT NULL CHECK (target_type IN ('npc', 'character')),
    target_id   UUID         NOT NULL,
    label       VARCHAR(100) NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (npc_id, target_type, target_id),
    CHECK (NOT (target_type = 'npc' AND target_id = npc_id))
);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_npc_id ON npcs.npc_relationships(npc_id);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_target ON npcs.npc_relationships(target_type, target_id);

CREATE TABLE IF NOT EXISTS npcs.collections (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    image_crop  JSONB,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_npcs_collections_created_by ON npcs.collections(created_by);
CREATE INDEX IF NOT EXISTS idx_npcs_collections_is_public  ON npcs.collections(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS npcs.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES npcs.collections(id) ON DELETE CASCADE,
    npc_id        UUID        NOT NULL REFERENCES npcs.npcs(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, npc_id)
);
CREATE INDEX IF NOT EXISTS idx_npcs_collection_items_collection_id ON npcs.collection_items(collection_id);

-- ---------------------------------------------------------------- collections
-- A mixed collection splits by item type. Creature collections (and empty
-- ones) keep their id in bestiary; NPC collections keep their id unless it
-- was already taken by the bestiary copy.

INSERT INTO bestiary.collections (id, created_by, name, description, image_url, image_crop, is_public, created_at, updated_at)
SELECT c.id, c.created_by, c.name, c.description, c.image_url, c.image_crop, c.is_public, c.created_at, c.updated_at
FROM compendium.collections c
WHERE EXISTS (SELECT 1 FROM compendium.collection_items i JOIN bestiary.creatures cr ON cr.id = i.entry_id WHERE i.collection_id = c.id)
   OR NOT EXISTS (SELECT 1 FROM compendium.collection_items i WHERE i.collection_id = c.id);

INSERT INTO bestiary.collection_items (id, collection_id, creature_id, created_at)
SELECT i.id, i.collection_id, i.entry_id, i.created_at
FROM compendium.collection_items i JOIN bestiary.creatures cr ON cr.id = i.entry_id;

CREATE TEMP TABLE npc_collection_map ON COMMIT DROP AS
SELECT c.id AS old_id,
       CASE WHEN EXISTS (SELECT 1 FROM bestiary.collections b WHERE b.id = c.id) THEN gen_random_uuid() ELSE c.id END AS new_id
FROM compendium.collections c
WHERE EXISTS (SELECT 1 FROM compendium.collection_items i JOIN npcs.npcs n ON n.id = i.entry_id WHERE i.collection_id = c.id)
   OR NOT EXISTS (SELECT 1 FROM compendium.collection_items i WHERE i.collection_id = c.id);

INSERT INTO npcs.collections (id, created_by, name, description, image_url, image_crop, is_public, created_at, updated_at)
SELECT m.new_id, c.created_by, c.name, c.description, c.image_url, c.image_crop, c.is_public, c.created_at, c.updated_at
FROM compendium.collections c JOIN npc_collection_map m ON m.old_id = c.id;

INSERT INTO npcs.collection_items (collection_id, npc_id, created_at)
SELECT m.new_id, i.entry_id, i.created_at
FROM compendium.collection_items i
JOIN npc_collection_map m ON m.old_id = i.collection_id
JOIN npcs.npcs n ON n.id = i.entry_id;

-- ---------------------------------------------------------------- cleanup

DROP TABLE compendium.collection_items;
DROP TABLE compendium.collections;
DROP TABLE compendium.compendium_equipment;
DROP TABLE compendium.compendium_spells;
DROP TABLE compendium.compendium_abilities;
DROP TABLE compendium.compendium_entries;

-- ---------------------------------------------------------------- taxonomy triggers
-- Deleting a species/subspecies/race/people used to SET NULL the matching
-- column on compendium_entries via FK. Entries now live in other schemas,
-- so the same effect is kept with a row trigger (also fires for subspecies/
-- peoples removed by the species/race ON DELETE CASCADE).

CREATE OR REPLACE FUNCTION compendium.clear_taxonomy_refs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('UPDATE npcs.npcs SET %1$I = NULL WHERE %1$I = $1', TG_ARGV[0]) USING OLD.id;
    EXECUTE format('UPDATE bestiary.creatures SET %1$I = NULL WHERE %1$I = $1', TG_ARGV[0]) USING OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_species_clear_refs ON compendium.species;
CREATE TRIGGER trg_species_clear_refs AFTER DELETE ON compendium.species
    FOR EACH ROW EXECUTE FUNCTION compendium.clear_taxonomy_refs('species_id');

DROP TRIGGER IF EXISTS trg_subspecies_clear_refs ON compendium.subspecies;
CREATE TRIGGER trg_subspecies_clear_refs AFTER DELETE ON compendium.subspecies
    FOR EACH ROW EXECUTE FUNCTION compendium.clear_taxonomy_refs('subspecies_id');

DROP TRIGGER IF EXISTS trg_races_clear_refs ON compendium.races;
CREATE TRIGGER trg_races_clear_refs AFTER DELETE ON compendium.races
    FOR EACH ROW EXECUTE FUNCTION compendium.clear_taxonomy_refs('race_id');

DROP TRIGGER IF EXISTS trg_peoples_clear_refs ON compendium.peoples;
CREATE TRIGGER trg_peoples_clear_refs AFTER DELETE ON compendium.peoples
    FOR EACH ROW EXECUTE FUNCTION compendium.clear_taxonomy_refs('people_id');

COMMIT;
