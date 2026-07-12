-- ================================================================
-- Equipment schema — GM-authored catalog of weapons/armor/artifacts/items
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
