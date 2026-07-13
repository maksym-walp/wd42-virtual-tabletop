-- ================================================================
-- Migration: skill-tree nodes' effect / narrative_condition become
-- repeatable list items (TEXT[]) instead of one free-text blob, so
-- multi-line bullet lists stop collapsing on render. Mirrors
-- spellbook.spells.components.
--
-- ALTER COLUMN ... TYPE ... USING can't contain a subquery, so the
-- per-row line-splitting is done via a plain UPDATE against new
-- columns instead, then the old columns are swapped out.
--
-- Guarded: on installs that replay every migration from scratch
-- against an already-current schema, narrative_condition/effect may
-- already be TEXT[] — skip the whole reshape in that case.
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'skill_tree' AND table_name = 'nodes'
      AND column_name = 'narrative_condition' AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE skill_tree.nodes
      ADD COLUMN IF NOT EXISTS effect_new TEXT[],
      ADD COLUMN IF NOT EXISTS narrative_condition_new TEXT[];

    UPDATE skill_tree.nodes n SET
      effect_new = COALESCE((
        SELECT array_agg(regexp_replace(btrim(line), '^[-•]\s*', ''))
        FROM unnest(regexp_split_to_array(n.effect, E'\n')) AS line
        WHERE btrim(line) <> ''
      ), '{}'),
      narrative_condition_new = COALESCE((
        SELECT array_agg(regexp_replace(btrim(line), '^[-•]\s*', ''))
        FROM unnest(regexp_split_to_array(n.narrative_condition, E'\n')) AS line
        WHERE btrim(line) <> ''
      ), '{}');

    ALTER TABLE skill_tree.nodes
      DROP COLUMN effect,
      DROP COLUMN narrative_condition;

    ALTER TABLE skill_tree.nodes
      RENAME COLUMN effect_new TO effect;
    ALTER TABLE skill_tree.nodes
      RENAME COLUMN narrative_condition_new TO narrative_condition;

    ALTER TABLE skill_tree.nodes
      ALTER COLUMN effect SET DEFAULT '{}',
      ALTER COLUMN effect SET NOT NULL,
      ALTER COLUMN narrative_condition SET DEFAULT '{}',
      ALTER COLUMN narrative_condition SET NOT NULL;
  END IF;
END $$;
