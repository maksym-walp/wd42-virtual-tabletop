-- ================================================================
-- Злиття сервісу маневрів назад у вміння.
--
-- "abilities" і "maneuvers" були двома мікросервісами-близнюками (однакова
-- структура, окрема схема кожен) — тепер маневри стають другим видом
-- всередині одного сервісу "abilities" (Вміння та маневри). На відміну від
-- 51-merge-artifacts-into-equipment.sql, тут немає спільної KINDS-моделі
-- для самих записів (вміння й маневри мають по-справжньому різні поля/
-- логіку) — уніфікується лише шар колекцій: одна abilities.collection_items
-- з дискримінатором item_kind замість двох окремих таблиць.
--
-- Односхідна деструктивна міграція (як 51/39): координований docker-compose
-- деплой, нуль-даунтайм тут не потрібен.
--
-- Id рядків ЗБЕРІГАЮТЬСЯ: на них посилаються character_sheet.maneuvers.
-- maneuver_id та compendium.compendium_maneuvers.maneuver_id (голі UUID
-- без FK).
-- ================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'maneuvers') THEN

    CREATE TABLE IF NOT EXISTS abilities.maneuvers (
        id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                UUID         NOT NULL,
        name                   VARCHAR(200) NOT NULL,
        duration_actions       SMALLINT     NOT NULL DEFAULT 1 CHECK (duration_actions BETWEEN 1 AND 3),
        description            TEXT,
        is_public              BOOLEAN      NOT NULL DEFAULT false,
        prerequisite_node_ids  UUID[]       NOT NULL DEFAULT '{}',
        prerequisite_logic     VARCHAR(3)   NOT NULL DEFAULT 'or' CHECK (prerequisite_logic IN ('and', 'or')),
        image_url              VARCHAR(500),
        is_canonical           BOOLEAN      NOT NULL DEFAULT false,
        created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_abilities_maneuvers_user_id     ON abilities.maneuvers(user_id);
    CREATE INDEX IF NOT EXISTS idx_abilities_maneuvers_public      ON abilities.maneuvers(is_public) WHERE is_public = true;
    CREATE INDEX IF NOT EXISTS idx_abilities_maneuvers_prereq_nodes ON abilities.maneuvers USING GIN (prerequisite_node_ids);

    -- Дискримінатор звʼязок з колекціями: item_id більше не може мати FK на
    -- одну таблицю (вказує або на abilities.entries, або на
    -- abilities.maneuvers) — знімаємо FK динамічно, як у
    -- 39-equipment-split-tables.sql, перейменовуємо колонку на генеричну
    -- item_id і додаємо item_kind. Наявні звʼязки лишаються 'ability' —
    -- саме таким був єдиний можливий вид до цієї міграції.
    EXECUTE (
        SELECT COALESCE(string_agg(
                   format('ALTER TABLE abilities.collection_items DROP CONSTRAINT %I;', conname), ' '),
               'SELECT 1')
        FROM pg_constraint
        WHERE conrelid = 'abilities.collection_items'::regclass
          AND contype = 'f'
          AND confrelid = 'abilities.entries'::regclass
    );

    ALTER TABLE abilities.collection_items RENAME COLUMN ability_id TO item_id;

    ALTER TABLE abilities.collection_items
        ADD COLUMN IF NOT EXISTS item_kind VARCHAR(10) NOT NULL DEFAULT 'ability'
        CHECK (item_kind IN ('ability', 'maneuver'));

    -- ── Перенесення рядків (не копія — джерело видаляється тут-таки) ──────
    INSERT INTO abilities.maneuvers
        (id, user_id, name, duration_actions, description, is_public,
         prerequisite_node_ids, prerequisite_logic, image_url, is_canonical, created_at, updated_at)
    SELECT id, user_id, name, duration_actions, description, is_public,
           prerequisite_node_ids, prerequisite_logic, image_url, is_canonical, created_at, updated_at
    FROM maneuvers.entries
    ON CONFLICT (id) DO NOTHING;

    -- Колекції маневрів зливаються в уже уніфіковані abilities.collections/
    -- collection_items — окремої лінії колекцій під маневри більше немає.
    INSERT INTO abilities.collections
        (id, user_id, name, description, is_public, prerequisite_node_ids,
         prerequisite_logic, image_url, is_canonical, created_at, updated_at)
    SELECT id, user_id, name, description, is_public, prerequisite_node_ids,
           prerequisite_logic, image_url, is_canonical, created_at, updated_at
    FROM maneuvers.collections
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO abilities.collection_items (id, collection_id, item_id, item_kind, created_at)
    SELECT id, collection_id, maneuver_id, 'maneuver', created_at
    FROM maneuvers.collection_items
    ON CONFLICT (collection_id, item_id) DO NOTHING;

    DROP SCHEMA maneuvers CASCADE;

  END IF;
END $$;
