-- ================================================================
-- Compendium collections: GM-curated named bundles of compendium_entries
-- (e.g. an encounter pack mixing NPCs and creatures), mirroring the
-- collections module already present in equipment/spellbook/maneuvers/
-- abilities (20-collections.sql) — same shape (name, description, is_public,
-- owner), minus two things those domains have that don't apply here:
--   - no prerequisite_node_ids/logic: that's a skill-tree unlock dependency
--     for player-facing progression content, not GM reference material.
--   - no is_canonical: compendium has no "official vs community" concept
--     anywhere else in its schema either.
-- collection_items uses a real FK to compendium_entries (same-service
-- reference), consistent with the rest of the schema's convention.
-- ================================================================

CREATE TABLE IF NOT EXISTS compendium.collections (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compendium_collections_created_by ON compendium.collections(created_by);
CREATE INDEX IF NOT EXISTS idx_compendium_collections_is_public  ON compendium.collections(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS compendium.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES compendium.collections(id) ON DELETE CASCADE,
    entry_id      UUID        NOT NULL REFERENCES compendium.compendium_entries(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_compendium_collection_items_collection_id ON compendium.collection_items(collection_id);
