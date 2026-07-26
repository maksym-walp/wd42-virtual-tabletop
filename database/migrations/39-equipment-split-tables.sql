-- ================================================================
-- Розділення каталогу спорядження на три таблиці.
--
-- equipment.items тримала зброю, обладунки та звичайні предмети під одним
-- `type`, тож кожен рядок ніс колонки, які його типу не стосуються
-- (damage_die/weapon_type/weapon_grip — лише зброя, defense_value/
-- armor_weight — лише обладунки). Після розділення кожна таблиця має рівно
-- ті поля, які має її вид, а сам `type` зникає — його роль виконує таблиця.
-- Той самий підхід, що й у 24/25-artifacts-service.sql.
--
-- УВАГА: міграція деструктивна і не сумісна зі старим кодом — застосовувати
-- разом із деплоєм нового equipment/character-sheet/user-profile. На відміну
-- від артефактів, тут немає additive-фази.
--
-- Id рядків ЗБЕРІГАЮТЬСЯ при переносі: на них посилаються
-- character_sheet.equipment.equipment_id (голий UUID, без FK) та
-- spellbook.spells.components[].item_id (у jsonb), тож переїзд у нову
-- таблицю для них непомітний. Оскільки UUID унікальні глобально,
-- equipment.collection_items.item_id теж лишається робочим ключем — до
-- нього лише додається item_kind, який каже, у якій із трьох таблиць
-- шукати рядок.
-- ================================================================

CREATE TABLE IF NOT EXISTS equipment.weapons (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL,
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    is_public     BOOLEAN      NOT NULL DEFAULT false,
    is_canonical  BOOLEAN      NOT NULL DEFAULT false,
    price         SMALLINT     CHECK (price IS NULL OR price >= 0),
    image_url     VARCHAR(500),
    damage_die    VARCHAR(10)  CHECK (damage_die IS NULL OR damage_die IN ('d4','d6','d8','d10','d12')),
    weapon_type   VARCHAR(20)  CHECK (weapon_type IS NULL OR weapon_type IN ('melee','ranged','thrown','universal')),
    weapon_grip   VARCHAR(20)  CHECK (weapon_grip IS NULL OR weapon_grip IN ('one_handed','two_handed','versatile','other')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_weapons_user_id ON equipment.weapons(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_weapons_public  ON equipment.weapons(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS equipment.armor (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL,
    name           VARCHAR(200) NOT NULL,
    description    TEXT,
    is_public      BOOLEAN      NOT NULL DEFAULT false,
    is_canonical   BOOLEAN      NOT NULL DEFAULT false,
    price          SMALLINT     CHECK (price IS NULL OR price >= 0),
    image_url      VARCHAR(500),
    defense_value  SMALLINT     CHECK (defense_value IS NULL OR defense_value >= 0),
    armor_weight   VARCHAR(20)  CHECK (armor_weight IS NULL OR armor_weight IN ('light','medium','heavy')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_armor_user_id ON equipment.armor(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_armor_public  ON equipment.armor(is_public) WHERE is_public = true;

-- Дискримінатор для звʼязки колекцій: рядок колекції може вказувати на будь-яку
-- з трьох таблиць. Значення за замовчуванням 'item' одразу правильне для тих
-- звʼязок, що лишаються з предметами, — зброю/обладунки перепозначаємо нижче.
ALTER TABLE equipment.collection_items
    ADD COLUMN IF NOT EXISTS item_kind VARCHAR(10) NOT NULL DEFAULT 'item';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'equipment.collection_items'::regclass
          AND conname = 'collection_items_item_kind_check'
    ) THEN
        ALTER TABLE equipment.collection_items
            ADD CONSTRAINT collection_items_item_kind_check
            CHECK (item_kind IN ('item', 'weapon', 'armor'));
    END IF;
END $$;

-- Перенесення рядків. Блок під guard-ом: якщо `type` уже немає, міграцію вже
-- застосовано (або схему створено з нуля вже розділеною) — тоді нічого не робимо.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'equipment' AND table_name = 'items' AND column_name = 'type'
    ) THEN
        INSERT INTO equipment.weapons
            (id, user_id, name, description, is_public, is_canonical, price, image_url,
             damage_die, weapon_type, weapon_grip, created_at, updated_at)
        SELECT id, user_id, name, description, is_public, is_canonical, price, image_url,
               damage_die, weapon_type, weapon_grip, created_at, updated_at
        FROM equipment.items
        WHERE type = 'weapon'
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO equipment.armor
            (id, user_id, name, description, is_public, is_canonical, price, image_url,
             defense_value, armor_weight, created_at, updated_at)
        SELECT id, user_id, name, description, is_public, is_canonical, price, image_url,
               defense_value, armor_weight, created_at, updated_at
        FROM equipment.items
        WHERE type = 'armor'
        ON CONFLICT (id) DO NOTHING;

        -- Перепозначення звʼязок з колекціями — ДО видалення рядків, поки FK
        -- на equipment.items ще не спрацював каскадом.
        UPDATE equipment.collection_items ci
        SET item_kind = i.type
        FROM equipment.items i
        WHERE i.id = ci.item_id AND i.type IN ('weapon', 'armor');

        -- FK на items більше не описує звʼязку: item_id тепер вказує на одну з
        -- трьох таблиць залежно від item_kind. Знімаємо його ДО видалення
        -- рядків, інакше ON DELETE CASCADE знесе щойно перепозначені звʼязки.
        -- Імʼя шукаємо, а не пишемо буквально (як у 25-equipment-drop-artifacts.sql):
        -- воно згенероване Postgres і залежить від історії встановлення.
        EXECUTE (
            SELECT COALESCE(string_agg(
                       format('ALTER TABLE equipment.collection_items DROP CONSTRAINT %I;', conname), ' '),
                   'SELECT 1')
            FROM pg_constraint
            WHERE conrelid = 'equipment.collection_items'::regclass
              AND contype = 'f'
              AND confrelid = 'equipment.items'::regclass
        );

        DELETE FROM equipment.items WHERE type IN ('weapon', 'armor');

        -- Індекс idx_equipment_items_type зникає разом зі своєю колонкою.
        ALTER TABLE equipment.items
            DROP COLUMN type,
            DROP COLUMN damage_die,
            DROP COLUMN defense_value,
            DROP COLUMN weapon_type,
            DROP COLUMN weapon_grip,
            DROP COLUMN armor_weight;
    END IF;
END $$;
