-- ================================================================
-- Злиття сервісу артефактів назад у спорядження.
--
-- Артефакти виділялись у власну схему/сервіс міграціями
-- 24-artifacts-service.sql / 25-equipment-drop-artifacts.sql. Тепер вони
-- повертаються як четвертий вид спорядження поруч із items/weapons/armor
-- (39-equipment-split-tables.sql) — той самий KINDS+item_kind патерн,
-- просто ще одна таблиця-гілка.
--
-- Односхідна деструктивна міграція (як 39, а не додатковий/деструктивний
-- дует 24/25): це внутрішній проєкт з одним координованим docker-compose
-- деплоєм, тож БД і код мігрують разом, вікно для поетапного розкочування
-- не потрібне.
--
-- Id рядків ЗБЕРІГАЮТЬСЯ: на них посилаються character_sheet.equipment.
-- equipment_id (голий UUID без FK) та equipment.collection_items.item_id.
-- ================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'artifacts') THEN

    CREATE TABLE IF NOT EXISTS equipment.artifacts (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID         NOT NULL,
        name         VARCHAR(200) NOT NULL,
        description  TEXT,
        is_public    BOOLEAN      NOT NULL DEFAULT false,
        is_canonical BOOLEAN      NOT NULL DEFAULT false,
        price        SMALLINT     CHECK (price IS NULL OR price >= 0),
        image_url    VARCHAR(500),
        creator      VARCHAR(200),
        rarity       VARCHAR(20)  CHECK (rarity IS NULL OR rarity IN ('common', 'uncommon', 'rare', 'legendary')),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_artifacts_user_id ON equipment.artifacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_artifacts_public  ON equipment.artifacts(is_public) WHERE is_public = true;
    CREATE INDEX IF NOT EXISTS idx_equipment_artifacts_rarity  ON equipment.artifacts(rarity);

    -- Дискримінатор звʼязок з колекціями отримує четверте значення.
    ALTER TABLE equipment.collection_items DROP CONSTRAINT IF EXISTS collection_items_item_kind_check;
    ALTER TABLE equipment.collection_items
        ADD CONSTRAINT collection_items_item_kind_check
        CHECK (item_kind IN ('item', 'weapon', 'armor', 'artifact'));

    -- ── Перенесення рядків (не копія — джерело видаляється тут-таки) ──────
    INSERT INTO equipment.artifacts
        (id, user_id, name, description, is_public, is_canonical, price, image_url, creator, rarity, created_at, updated_at)
    SELECT id, user_id, name, description, is_public, is_canonical, price, image_url, creator, rarity, created_at, updated_at
    FROM artifacts.entries
    ON CONFLICT (id) DO NOTHING;

    -- Колекції артефактів зливаються в уже уніфіковані equipment.collections/
    -- collection_items — окремої лінії колекцій під артефакти більше немає.
    INSERT INTO equipment.collections
        (id, user_id, name, description, is_public, is_canonical, image_url, created_at, updated_at)
    SELECT id, user_id, name, description, is_public, is_canonical, image_url, created_at, updated_at
    FROM artifacts.collections
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO equipment.collection_items (id, collection_id, item_id, item_kind, created_at)
    SELECT id, collection_id, artifact_id, 'artifact', created_at
    FROM artifacts.collection_items
    ON CONFLICT (collection_id, item_id) DO NOTHING;

    DROP SCHEMA artifacts CASCADE;

  END IF;
END $$;
