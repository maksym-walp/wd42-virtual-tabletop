-- ================================================================
-- New "artifacts" service, phase 1 of 2 — additive only.
--
-- Artifacts split out of the equipment catalog into their own schema/service.
-- They never shared equipment's mechanics (damage_die, defense_value,
-- weapon_type/grip, armor_weight are all NULL for them) and were the only
-- users of creator/rarity, so the shared equipment.items table carried a
-- column set that no single type used. artifacts.entries keeps only the
-- fields an artifact actually has.
--
-- This file ONLY creates the new schema and copies rows into it. Nothing is
-- dropped or deleted, so it is safe to apply while the OLD code is still
-- running: equipment.items keeps its artifact rows and creator/rarity
-- columns, and the old catalog goes on serving them. Apply this before
-- deploying the split, then 25-equipment-drop-artifacts.sql in a later
-- release once the new code is confirmed live.
--
-- Row ids are PRESERVED on the copy: character_sheet.equipment references
-- catalog rows by bare UUID (no FK, see 14-equipment-maneuvers-catalog.sql),
-- so every character sheet that already has an artifact keeps pointing at
-- the same row in its new home. character-sheet's equipment model resolves
-- those ids against both catalogs, skipping equipment.items' artifact rows
-- so the interim duplication between the two tables can't double a sheet row.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS artifacts;

CREATE TABLE IF NOT EXISTS artifacts.entries (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    price       SMALLINT     CHECK (price IS NULL OR price >= 0),
    image_url   VARCHAR(500),
    creator     VARCHAR(200),
    rarity      VARCHAR(20)  CHECK (rarity IS NULL OR rarity IN ('common', 'uncommon', 'rare', 'legendary')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_entries_user_id ON artifacts.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_entries_public  ON artifacts.entries(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_artifacts_entries_rarity  ON artifacts.entries(rarity);

-- Collections module, same shape as equipment's (no prerequisite_node_ids —
-- artifact entries have no prerequisite concept to inherit, see
-- 21-equipment-collections-remove-prereq.sql).
CREATE TABLE IF NOT EXISTS artifacts.collections (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts.collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES artifacts.collections(id) ON DELETE CASCADE,
    artifact_id   UUID        NOT NULL REFERENCES artifacts.entries(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, artifact_id)
);

-- ── Copy (not move) the artifact rows ────────────────────────────────────
-- Guarded so replaying every migration from scratch against a post-phase-2
-- schema is a no-op instead of erroring on the dropped `creator` column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'equipment' AND table_name = 'items' AND column_name = 'creator'
  ) THEN
    INSERT INTO artifacts.entries
      (id, user_id, name, description, is_public, price, image_url, creator, rarity, created_at, updated_at)
    SELECT id, user_id, name, description, is_public, price, image_url, creator, rarity, created_at, updated_at
    FROM equipment.items
    WHERE type = 'artifact'
    ON CONFLICT (id) DO NOTHING;

    -- An equipment collection that holds artifacts gets a mirror artifact
    -- collection carrying the same id/name/owner, so a shared link's UUID and
    -- the grouping the author made both survive the split. Mixed collections
    -- end up as two collections — one per catalog — which is the only
    -- well-defined outcome once the catalogs are separate.
    INSERT INTO artifacts.collections (id, user_id, name, description, is_public, created_at, updated_at)
    SELECT DISTINCT c.id, c.user_id, c.name, c.description, c.is_public, c.created_at, c.updated_at
    FROM equipment.collections c
    JOIN equipment.collection_items ci ON ci.collection_id = c.id
    JOIN equipment.items i ON i.id = ci.item_id AND i.type = 'artifact'
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO artifacts.collection_items (collection_id, artifact_id, created_at)
    SELECT ci.collection_id, ci.item_id, ci.created_at
    FROM equipment.collection_items ci
    JOIN equipment.items i ON i.id = ci.item_id AND i.type = 'artifact'
    ON CONFLICT (collection_id, artifact_id) DO NOTHING;
  END IF;
END $$;
