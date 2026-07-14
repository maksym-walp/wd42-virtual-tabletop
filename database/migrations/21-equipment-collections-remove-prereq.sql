-- Equipment (item/weapon/armor/artifact) collections should not carry a
-- skill-tree node dependency: unlike abilities/maneuvers/spells, individual
-- equipment.items rows have no prerequisite_node_ids concept at all (see
-- 19-catalog-prerequisite-nodes.sql), so gating a collection of them on a
-- node has nothing to actually inherit into. Ability/maneuver/spell
-- collections keep the columns added in 20-collections.sql.
-- Dropping the columns also drops idx_equipment_collections_prereq_nodes,
-- which depends on prerequisite_node_ids.
ALTER TABLE equipment.collections
    DROP COLUMN IF EXISTS prerequisite_node_ids,
    DROP COLUMN IF EXISTS prerequisite_logic;
