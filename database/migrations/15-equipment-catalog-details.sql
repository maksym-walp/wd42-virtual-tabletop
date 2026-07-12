-- ================================================================
-- Migration: extra equipment.items fields
--   - price: average cost in conventional units, all types
--   - image_url: weapon/armor/artifact
--   - weapon_type / weapon_grip: weapon only
--   - armor_weight: armor only
--   - creator / rarity: artifact only
-- ================================================================

ALTER TABLE equipment.items
  ADD COLUMN IF NOT EXISTS price SMALLINT
    CHECK (price IS NULL OR price >= 0),
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS weapon_type VARCHAR(20)
    CHECK (weapon_type IS NULL OR weapon_type IN ('melee', 'ranged', 'thrown', 'universal')),
  ADD COLUMN IF NOT EXISTS weapon_grip VARCHAR(20)
    CHECK (weapon_grip IS NULL OR weapon_grip IN ('one_handed', 'two_handed', 'versatile', 'other')),
  ADD COLUMN IF NOT EXISTS armor_weight VARCHAR(20)
    CHECK (armor_weight IS NULL OR armor_weight IN ('light', 'medium', 'heavy')),
  ADD COLUMN IF NOT EXISTS creator VARCHAR(200),
  ADD COLUMN IF NOT EXISTS rarity VARCHAR(20)
    CHECK (rarity IS NULL OR rarity IN ('common', 'uncommon', 'rare', 'legendary'));
