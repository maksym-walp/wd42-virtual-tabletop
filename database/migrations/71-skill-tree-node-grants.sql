-- ================================================================
-- Migration: skill_tree.node_grants — links a tree node to catalog
-- entries (abilities / maneuvers / spells) or whole collections
-- (ability or spell collections), with a per-link mode:
--
--   'unlock' — opening the node makes the entry available to add
--              (merges with the entry's own prerequisite_node_ids)
--   'grant'  — opening the node adds the entry straight to the
--              character sheet (collections expanded to their items)
--
-- item_id is a bare cross-service UUID (no FK), same convention as
-- abilities.entries.prerequisite_node_ids etc. Equipment is absent
-- on purpose — it has no node-prerequisite concept (migration 21).
-- ================================================================

CREATE TABLE IF NOT EXISTS skill_tree.node_grants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id    UUID NOT NULL REFERENCES skill_tree.nodes(id) ON DELETE CASCADE,
    item_kind  VARCHAR(20) NOT NULL
                 CHECK (item_kind IN ('ability', 'maneuver', 'spell',
                                      'ability_collection', 'spell_collection')),
    item_id    UUID NOT NULL,
    mode       VARCHAR(10) NOT NULL DEFAULT 'unlock'
                 CHECK (mode IN ('grant', 'unlock')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (node_id, item_kind, item_id)
);

CREATE INDEX IF NOT EXISTS idx_node_grants_node ON skill_tree.node_grants(node_id);
CREATE INDEX IF NOT EXISTS idx_node_grants_item ON skill_tree.node_grants(item_id);
