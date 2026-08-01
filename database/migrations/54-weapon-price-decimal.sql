-- ================================================================
-- price: SMALLINT → NUMERIC(10,2). "Орієнтовна вартість" is meant to be a
-- rough guideline ("уточніть у майстра"), and fractional units (e.g. 2.5
-- coins) are a legitimate price in this system's currencies — SMALLINT
-- couldn't represent that. Applies to all four equipment tables, since
-- price is a column every kind shares.
--
-- weapon_type: add 'other' — the type dropdown only had melee/ranged/
-- thrown/universal, with no catch-all for weapons that fit none of them.
-- ================================================================

ALTER TABLE equipment.items    ALTER COLUMN price TYPE NUMERIC(10,2);
ALTER TABLE equipment.weapons  ALTER COLUMN price TYPE NUMERIC(10,2);
ALTER TABLE equipment.armor    ALTER COLUMN price TYPE NUMERIC(10,2);
ALTER TABLE equipment.artifacts ALTER COLUMN price TYPE NUMERIC(10,2);

ALTER TABLE equipment.weapons
  DROP CONSTRAINT IF EXISTS weapons_weapon_type_check,
  ADD CONSTRAINT weapons_weapon_type_check
    CHECK (weapon_type IS NULL OR weapon_type IN ('melee', 'ranged', 'thrown', 'universal', 'other'));
