-- ================================================================
-- Migration: optional skill-tree node prerequisites for catalog
--   entries (abilities, maneuvers, spells). A character cannot add
--   one of these to their sheet unless the referenced node(s) are
--   unlocked, per prerequisite_logic ('and' = all required,
--   'or' = any one suffices). Bare UUID[] with no FK, consistent
--   with the rest of the schema's cross-service references.
-- ================================================================

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS prerequisite_node_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prerequisite_logic VARCHAR(3) NOT NULL DEFAULT 'or'
        CHECK (prerequisite_logic IN ('and', 'or'));

ALTER TABLE maneuvers.entries
    ADD COLUMN IF NOT EXISTS prerequisite_node_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prerequisite_logic VARCHAR(3) NOT NULL DEFAULT 'or'
        CHECK (prerequisite_logic IN ('and', 'or'));

ALTER TABLE spellbook.spells
    ADD COLUMN IF NOT EXISTS prerequisite_node_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prerequisite_logic VARCHAR(3) NOT NULL DEFAULT 'or'
        CHECK (prerequisite_logic IN ('and', 'or'));

CREATE INDEX IF NOT EXISTS idx_abilities_entries_prereq_nodes ON abilities.entries USING GIN (prerequisite_node_ids);
CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_prereq_nodes ON maneuvers.entries USING GIN (prerequisite_node_ids);
CREATE INDEX IF NOT EXISTS idx_spellbook_spells_prereq_nodes ON spellbook.spells USING GIN (prerequisite_node_ids);
