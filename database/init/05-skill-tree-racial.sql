-- Skill tree features: root nodes, archetype filtering, narrative unlock conditions

ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT false;

-- Columns below are also added by database/migrations/{01,02,04}-skill-tree-v{2,3,5}.sql
-- and database/migrations/05-character-sheet.sql for pre-existing installs; kept here
-- (idempotent, IF NOT EXISTS) so a fresh init/ run is self-sufficient before 06- runs.
ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS narrative_condition TEXT,
  ADD COLUMN IF NOT EXISTS effect              TEXT;

ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS archetype VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS require_both BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS archetypes TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE skill_tree.edges
  ADD COLUMN IF NOT EXISTS edge_type VARCHAR(20) NOT NULL DEFAULT 'required';

ALTER TABLE skill_tree.edges DROP CONSTRAINT IF EXISTS edges_edge_type_check;
ALTER TABLE skill_tree.edges
  ADD CONSTRAINT edges_edge_type_check
    CHECK (edge_type IN ('required', 'optional'));
