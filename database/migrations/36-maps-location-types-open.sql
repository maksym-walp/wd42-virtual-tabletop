-- ================================================================
-- Location types are now defined by a frontend-editable config
-- (public/map-markers/types.json), so the hardcoded CHECK on
-- maps.locations.type is dropped and the column widened to hold
-- arbitrary short type keys.
-- ================================================================

-- Drop any CHECK constraint on maps.locations that references `type`
-- (auto-named locations_type_check from migration 35).
DO $$
DECLARE conname_var text;
BEGIN
  FOR conname_var IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'maps.locations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE maps.locations DROP CONSTRAINT %I', conname_var);
  END LOOP;
END $$;

ALTER TABLE maps.locations ALTER COLUMN type TYPE VARCHAR(50);
