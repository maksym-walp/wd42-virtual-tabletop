-- Drop old single-type constraint column
ALTER TABLE skill_tree.nodes DROP COLUMN IF EXISTS unlock_type;
-- Add race restrictions (empty array = available to all)
ALTER TABLE skill_tree.nodes ADD COLUMN IF NOT EXISTS races TEXT[] NOT NULL DEFAULT '{}';
-- cost = 0 means "not available via points"; narrative_condition NULL means "not available narratively"
