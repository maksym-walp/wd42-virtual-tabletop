ALTER TABLE skill_tree.edges
  ADD COLUMN IF NOT EXISTS edge_type VARCHAR(20) NOT NULL DEFAULT 'required'
    CHECK (edge_type IN ('required', 'optional'));
