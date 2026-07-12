ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS unlock_type       VARCHAR(20) NOT NULL DEFAULT 'points'
    CHECK (unlock_type IN ('points', 'narrative')),
  ADD COLUMN IF NOT EXISTS narrative_condition TEXT,
  ADD COLUMN IF NOT EXISTS effect              TEXT;
