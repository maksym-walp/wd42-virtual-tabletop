-- Race no longer affects the skill tree (nodes are archetype-only now); race instead
-- gives a starting-skill bonus (see CharacterNew.jsx). Drop the now-dead racial
-- tree columns/table and the sangvi ancestor-race choice.

ALTER TABLE skill_tree.nodes DROP COLUMN IF EXISTS races;
ALTER TABLE skill_tree.nodes DROP COLUMN IF EXISTS replaces_node_id;

UPDATE skill_tree.edges SET edge_type = 'required' WHERE edge_type = 'bridge';

ALTER TABLE skill_tree.edges DROP CONSTRAINT IF EXISTS edges_edge_type_check;
ALTER TABLE skill_tree.edges
  ADD CONSTRAINT edges_edge_type_check
    CHECK (edge_type IN ('required', 'optional'));

DROP TABLE IF EXISTS character_sheet.nephilim_breakthroughs;

ALTER TABLE character_sheet.characters DROP COLUMN IF EXISTS race_ancestry;
