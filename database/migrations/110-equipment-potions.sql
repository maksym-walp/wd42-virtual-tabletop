-- ================================================================
-- Зілля — пʼятий вид спорядження (equipment.potions), той самий
-- KINDS+item_kind патерн, що й артефакти (51-merge-artifacts-into-equipment.sql).
--
-- Поки що єдиний ефект — зцілення (effect = 'healing'). Рівень визначає
-- кубик зцілення однієї порції, розмір — кількість порцій в ємності:
--   potion_tier: tincture (Настоянка) d4, decoction (Відвар) d6,
--                balm (Бальзам) d8, elixir (Еліксир) d10, extract (Екстракт) d12
--   potion_size: ampoule (Ампула) 1, tube (Пробірка) 3, flask (Флакон) 6,
--                carafe (Карафа) 10
-- heal_die і portions — згенеровані колонки: це єдине джерело відповідності
-- «рівень → кубик» і «розмір → порції» для equipment і character-sheet.
--
-- Засів: 20 канонічних зіль зцілення (5 рівнів × 4 розміри) від імені
-- першого адміна (або ГМ); без жодного такого користувача засів пропускається.
-- ================================================================

CREATE TABLE IF NOT EXISTS equipment.potions (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NOT NULL,
    name          VARCHAR(200)  NOT NULL,
    description   TEXT,
    is_public     BOOLEAN       NOT NULL DEFAULT false,
    is_canonical  BOOLEAN       NOT NULL DEFAULT false,
    price         NUMERIC(10,2) CHECK (price IS NULL OR price >= 0),
    image_url     VARCHAR(500),
    thumbnail_url VARCHAR(500),
    image_crop    JSONB,
    effect        VARCHAR(20)   NOT NULL DEFAULT 'healing' CHECK (effect IN ('healing')),
    potion_tier   VARCHAR(20)   NOT NULL DEFAULT 'tincture'
                  CHECK (potion_tier IN ('tincture', 'decoction', 'balm', 'elixir', 'extract')),
    potion_size   VARCHAR(20)   NOT NULL DEFAULT 'ampoule'
                  CHECK (potion_size IN ('ampoule', 'tube', 'flask', 'carafe')),
    heal_die      SMALLINT      GENERATED ALWAYS AS (
                    CASE potion_tier
                      WHEN 'tincture' THEN 4 WHEN 'decoction' THEN 6 WHEN 'balm' THEN 8
                      WHEN 'elixir' THEN 10 WHEN 'extract' THEN 12
                    END) STORED,
    portions      SMALLINT      GENERATED ALWAYS AS (
                    CASE potion_size
                      WHEN 'ampoule' THEN 1 WHEN 'tube' THEN 3 WHEN 'flask' THEN 6 WHEN 'carafe' THEN 10
                    END) STORED,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_potions_user_id ON equipment.potions(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_potions_public  ON equipment.potions(is_public) WHERE is_public = true;

ALTER TABLE equipment.collection_items DROP CONSTRAINT IF EXISTS collection_items_item_kind_check;
ALTER TABLE equipment.collection_items
    ADD CONSTRAINT collection_items_item_kind_check
    CHECK (item_kind IN ('item', 'weapon', 'armor', 'artifact', 'potion'));

WITH owner AS (
    SELECT id FROM auth.users
    WHERE role IN ('admin', 'game_master')
    ORDER BY (role = 'admin') DESC, created_at
    LIMIT 1
),
tiers (tier, label, die, ord) AS (VALUES
    ('tincture', 'Настоянка', 4, 1), ('decoction', 'Відвар', 6, 2), ('balm', 'Бальзам', 8, 3),
    ('elixir', 'Еліксир', 10, 4), ('extract', 'Екстракт', 12, 5)
),
sizes (size, label, portions, ord) AS (VALUES
    ('ampoule', 'ампула', 1, 1), ('tube', 'пробірка', 3, 2), ('flask', 'флакон', 6, 3), ('carafe', 'карафа', 10, 4)
)
INSERT INTO equipment.potions (user_id, name, description, is_public, is_canonical, effect, potion_tier, potion_size)
SELECT owner.id,
       t.label || ' зцілення (' || s.label || ')',
       '<p>Зцілення: кожна порція відновлює 1d' || t.die || ' здоровʼя. ' ||
       initcap(s.label) || ' — ' || s.portions ||
       CASE WHEN s.portions = 1 THEN ' порція' WHEN s.portions < 5 THEN ' порції' ELSE ' порцій' END || '.</p>',
       true, true, 'healing', t.tier, s.size
FROM owner, tiers t, sizes s
WHERE NOT EXISTS (
    SELECT 1 FROM equipment.potions p
    WHERE p.is_canonical AND p.potion_tier = t.tier AND p.potion_size = s.size AND p.effect = 'healing'
)
ORDER BY t.ord, s.ord;
