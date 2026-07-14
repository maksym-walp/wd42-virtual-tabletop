-- Collections: per-domain grouping of catalog entries (equipment, abilities,
-- maneuvers, spells), each shareable via its own public link, matching the
-- existing character_sheet.characters is_public + raw-UUID sharing pattern.
--
-- Modeled as a module inside each catalog's own service/schema (not a
-- separate microservice), since equipment.items already unifies weapons/
-- armor/artifacts/items under one table via its `type` column, and each of
-- the four catalogs is independently owned/authored content.
--
-- prerequisite_node_ids/prerequisite_logic on the collection itself follow
-- the same bare-UUID[]-no-FK convention introduced in
-- 19-catalog-prerequisite-nodes.sql: a skill-tree node dependency added to
-- the collection is inherited by every item placed inside it (the effective
-- prerequisite for an item accessed via a collection is the union of the
-- item's own prerequisite, if any, AND the collection's).
--
-- collection_items uses a real FK to the catalog table (same-service
-- reference), consistent with the rest of the schema's convention of real
-- FKs within a service and bare UUIDs across services.

-- ── equipment ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment.collections (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID         NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    description            TEXT,
    is_public              BOOLEAN      NOT NULL DEFAULT false,
    prerequisite_node_ids  UUID[]       NOT NULL DEFAULT '{}',
    prerequisite_logic     VARCHAR(3)   NOT NULL DEFAULT 'or' CHECK (prerequisite_logic IN ('and', 'or')),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_collections_prereq_nodes
    ON equipment.collections USING GIN (prerequisite_node_ids);

CREATE TABLE IF NOT EXISTS equipment.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES equipment.collections(id) ON DELETE CASCADE,
    item_id       UUID        NOT NULL REFERENCES equipment.items(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, item_id)
);

-- ── abilities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abilities.collections (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID         NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    description            TEXT,
    is_public              BOOLEAN      NOT NULL DEFAULT false,
    prerequisite_node_ids  UUID[]       NOT NULL DEFAULT '{}',
    prerequisite_logic     VARCHAR(3)   NOT NULL DEFAULT 'or' CHECK (prerequisite_logic IN ('and', 'or')),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abilities_collections_prereq_nodes
    ON abilities.collections USING GIN (prerequisite_node_ids);

CREATE TABLE IF NOT EXISTS abilities.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES abilities.collections(id) ON DELETE CASCADE,
    ability_id    UUID        NOT NULL REFERENCES abilities.entries(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, ability_id)
);

-- ── maneuvers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maneuvers.collections (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID         NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    description            TEXT,
    is_public              BOOLEAN      NOT NULL DEFAULT false,
    prerequisite_node_ids  UUID[]       NOT NULL DEFAULT '{}',
    prerequisite_logic     VARCHAR(3)   NOT NULL DEFAULT 'or' CHECK (prerequisite_logic IN ('and', 'or')),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maneuvers_collections_prereq_nodes
    ON maneuvers.collections USING GIN (prerequisite_node_ids);

CREATE TABLE IF NOT EXISTS maneuvers.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES maneuvers.collections(id) ON DELETE CASCADE,
    maneuver_id   UUID        NOT NULL REFERENCES maneuvers.entries(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, maneuver_id)
);

-- ── spellbook ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spellbook.collections (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID         NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    description            TEXT,
    is_public              BOOLEAN      NOT NULL DEFAULT false,
    prerequisite_node_ids  UUID[]       NOT NULL DEFAULT '{}',
    prerequisite_logic     VARCHAR(3)   NOT NULL DEFAULT 'or' CHECK (prerequisite_logic IN ('and', 'or')),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spellbook_collections_prereq_nodes
    ON spellbook.collections USING GIN (prerequisite_node_ids);

CREATE TABLE IF NOT EXISTS spellbook.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES spellbook.collections(id) ON DELETE CASCADE,
    spell_id      UUID        NOT NULL REFERENCES spellbook.spells(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, spell_id)
);
