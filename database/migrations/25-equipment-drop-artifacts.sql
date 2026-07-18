-- ================================================================
-- "artifacts" service, phase 2 of 2 — destructive cleanup.
--
-- Removes what 24-artifacts-service.sql copied out: the artifact rows in
-- equipment.items and the artifact-only creator/rarity columns, narrowing the
-- type CHECK to what the equipment catalog still serves.
--
-- APPLY ONLY AFTER the split is deployed and confirmed working. Until then
-- equipment.items keeps serving artifacts to the old code; running this
-- against the old code breaks item creation (INSERT into dropped columns) and
-- empties the artifact tab of the old catalog.
--
-- The copy from phase 1 is repeated first: any artifact authored through the
-- old catalog in the window between the two migrations exists only in
-- equipment.items and would otherwise be lost to the DELETE below.
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'equipment' AND table_name = 'items' AND column_name = 'creator'
  ) THEN
    -- Catch stragglers created after phase 1 ran.
    INSERT INTO artifacts.entries
      (id, user_id, name, description, is_public, price, image_url, creator, rarity, created_at, updated_at)
    SELECT id, user_id, name, description, is_public, price, image_url, creator, rarity, created_at, updated_at
    FROM equipment.items
    WHERE type = 'artifact'
    ON CONFLICT (id) DO NOTHING;

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

    -- Removes the copied rows and, by FK cascade, their
    -- equipment.collection_items links.
    DELETE FROM equipment.items WHERE type = 'artifact';

    ALTER TABLE equipment.items
      DROP COLUMN creator,
      DROP COLUMN rarity;

    -- Looked up rather than named literally: the inline CHECK from
    -- 08-equipment.sql / 14-equipment-maneuvers-catalog.sql got whatever name
    -- Postgres generated, which differs between install histories.
    EXECUTE (
      SELECT COALESCE(string_agg(format('ALTER TABLE equipment.items DROP CONSTRAINT %I;', conname), ' '), 'SELECT 1')
      FROM pg_constraint
      WHERE conrelid = 'equipment.items'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%artifact%'
    );
    ALTER TABLE equipment.items
      ADD CONSTRAINT items_type_check CHECK (type IN ('weapon', 'armor', 'item'));
  END IF;
END $$;
