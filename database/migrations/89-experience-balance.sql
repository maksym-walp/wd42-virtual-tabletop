-- ================================================================
-- Migration: experience_points becomes a plain balance, spent only on the
-- development tree.
--
-- Previously (migration 70) experience_points was a TOTAL and the spend was
-- derived on read:
--   remaining = total - Σ skills[(value - base_value) * 5 + progress_marks]
--                     - Σ unlocked non-root nodes.cost
-- Now skills are raised with game inspiration / narratively and never cost
-- experience; unlocking a node decrements the balance directly.
--
-- Convert every character's total into the remaining value it showed
-- before this migration, so nobody gains or loses points.
-- NOT idempotent — must run exactly once.
-- ================================================================

UPDATE character_sheet.characters c
   SET experience_points = GREATEST(
         c.experience_points
         - COALESCE((SELECT SUM(n.cost)
                       FROM character_sheet.tree_progress tp
                       JOIN skill_tree.nodes n ON n.id = tp.node_id
                      WHERE tp.character_id = c.id AND n.is_root = false), 0)
         - COALESCE((SELECT SUM(GREATEST(s.value - s.base_value, 0) * 5 + s.progress_marks)
                       FROM character_sheet.skills s
                      WHERE s.character_id = c.id), 0),
         0);
