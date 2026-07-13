-- ================================================================
-- Migration: equipment/maneuvers catalogs
--   - New schemas equipment/maneuvers (GM-authored catalogs, mirrors spellbook)
--   - character_sheet.equipment / .maneuvers become reference tables
--     (character_id + catalog id + per-character progress), mirroring
--     character_sheet.known_spells. Existing freeform rows are test data
--     only (app not yet deployed) and are discarded.
--
-- The reshape blocks below are guarded: on installs that replay every
-- migration from scratch against an already-current schema, the old
-- freeform columns (name/slot/... or name/duration_actions/...) may
-- already be gone — skip in that case instead of erroring on DROP
-- COLUMN/ADD CONSTRAINT against objects that no longer/already exist.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS equipment;

CREATE TABLE IF NOT EXISTS equipment.items (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL,
    name           VARCHAR(200) NOT NULL,
    type           VARCHAR(20)  NOT NULL DEFAULT 'item'
                   CHECK (type IN ('weapon','armor','artifact','item')),
    damage_die     VARCHAR(10)  CHECK (damage_die IS NULL OR damage_die IN ('d4','d6','d8','d10','d12')),
    defense_value  SMALLINT     CHECK (defense_value IS NULL OR defense_value >= 0),
    description    TEXT,
    is_public      BOOLEAN      NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_items_user_id ON equipment.items(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_type    ON equipment.items(type);
CREATE INDEX IF NOT EXISTS idx_equipment_items_public  ON equipment.items(is_public) WHERE is_public = true;

CREATE SCHEMA IF NOT EXISTS maneuvers;

CREATE TABLE IF NOT EXISTS maneuvers.entries (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL,
    name              VARCHAR(200) NOT NULL,
    duration_actions  SMALLINT     NOT NULL DEFAULT 1 CHECK (duration_actions BETWEEN 1 AND 3),
    description       TEXT,
    is_public         BOOLEAN      NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_user_id ON maneuvers.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_public  ON maneuvers.entries(is_public) WHERE is_public = true;

-- Discard old freeform rows (test data only) and turn character_sheet.equipment
-- into a reference+progress table, like character_sheet.known_spells.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'character_sheet' AND table_name = 'equipment' AND column_name = 'name'
  ) THEN
    TRUNCATE character_sheet.equipment;
    ALTER TABLE character_sheet.equipment
      DROP COLUMN name,
      DROP COLUMN slot,
      DROP COLUMN damage_die,
      DROP COLUMN defense_value,
      DROP COLUMN notes,
      ADD COLUMN equipment_id UUID NOT NULL;
    ALTER TABLE character_sheet.equipment
      ADD CONSTRAINT uq_cs_equipment_char_item UNIQUE (character_id, equipment_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cs_equipment_equipment_id ON character_sheet.equipment(equipment_id);

-- Same treatment for character_sheet.maneuvers (no progress fields — remove-only).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'character_sheet' AND table_name = 'maneuvers' AND column_name = 'name'
  ) THEN
    TRUNCATE character_sheet.maneuvers;
    ALTER TABLE character_sheet.maneuvers
      DROP COLUMN name,
      DROP COLUMN duration_actions,
      DROP COLUMN description,
      ADD COLUMN maneuver_id UUID NOT NULL;
    ALTER TABLE character_sheet.maneuvers
      ADD CONSTRAINT uq_cs_maneuvers_char_maneuver UNIQUE (character_id, maneuver_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cs_maneuvers_maneuver_id ON character_sheet.maneuvers(maneuver_id);
