-- ================================================================
-- Спрощення структури вмінь: маневр перестає бути окремою сутністю.
--
-- До цієї міграції "вміння" (abilities.entries) і "маневри"
-- (abilities.maneuvers) були двома таблицями-близнючками в одному сервісі
-- (наслідок 52-merge-maneuvers-into-abilities.sql). Тепер маневр — це
-- просто вміння з булевим прапорцем is_maneuver ("Може бути використано
-- як маневр (дія в бою)") і полем тривалості того ж вигляду, що й у
-- заклинань (duration_value + duration_unit), розширеним одиницею
-- 'action' для сумісності зі старим duration_actions.
--
-- Id рядків ЗБЕРІГАЮТЬСЯ (як і в 52) — тому character_sheet.maneuvers.
-- maneuver_id, compendium.compendium_maneuvers.maneuver_id і
-- skill_tree.node_grants (item_kind='maneuver') продовжують вказувати на
-- ті самі рядки, які просто стають рядками abilities.entries.
--
-- Односхідна деструктивна міграція (як 51/52): координований
-- docker-compose деплой, нуль-даунтайм тут не потрібен.
-- ================================================================

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS is_maneuver BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS duration_value INTEGER,
    ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(20) NOT NULL DEFAULT 'instant'
        CHECK (duration_unit IN ('instant', 'action', 'seconds', 'minutes', 'hours', 'days', 'permanent'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'abilities' AND table_name = 'maneuvers') THEN

    -- ── Перенесення рядків маневрів у вміння ──────────────────────────────
    -- archetypes = '{fighter}', бо стара таблиця маневрів не мала поля
    -- archetypes взагалі — вона й так була доступна лише бійцю (мігруємо
    -- цю прив'язку явно, інакше пікер "+ Додати вміння" на листі бійця,
    -- який фільтрує каталог за archetypes, просто не покаже ці рядки).
    INSERT INTO abilities.entries
        (id, user_id, name, archetypes, description, is_public,
         prerequisite_node_ids, prerequisite_logic, image_url, is_canonical,
         is_maneuver, duration_value, duration_unit, created_at, updated_at)
    SELECT id, user_id, name, '{fighter}', description, is_public,
           prerequisite_node_ids, prerequisite_logic, image_url, is_canonical,
           true, duration_actions, 'action', created_at, updated_at
    FROM abilities.maneuvers
    ON CONFLICT (id) DO NOTHING;

    -- ── Колекції: item_id/item_kind були потрібні лише поки існували дві
    -- таблиці — тепер знову проста FK-звʼязка на abilities.entries.
    EXECUTE (
        SELECT COALESCE(string_agg(
                   format('ALTER TABLE abilities.collection_items DROP CONSTRAINT %I;', conname), ' '),
               'SELECT 1')
        FROM pg_constraint
        WHERE conrelid = 'abilities.collection_items'::regclass
          AND contype = 'c'
    );

    ALTER TABLE abilities.collection_items DROP COLUMN IF EXISTS item_kind;
    ALTER TABLE abilities.collection_items RENAME COLUMN item_id TO ability_id;
    ALTER TABLE abilities.collection_items
        ADD CONSTRAINT fk_abilities_collection_items_ability
        FOREIGN KEY (ability_id) REFERENCES abilities.entries(id) ON DELETE CASCADE;

    DROP TABLE abilities.maneuvers;

  END IF;
END $$;

-- ── character_sheet: character_sheet.maneuvers → character_sheet.abilities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'character_sheet' AND table_name = 'maneuvers') THEN

    INSERT INTO character_sheet.abilities (character_id, ability_id)
    SELECT character_id, maneuver_id FROM character_sheet.maneuvers
    ON CONFLICT (character_id, ability_id) DO NOTHING;

    DROP TABLE character_sheet.maneuvers;

  END IF;
END $$;

-- ── compendium: compendium_maneuvers → compendium_abilities (перейменування
-- в місці — дані й UNIQUE-обмеження на (entry_id, ability_id) зберігаються).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'compendium' AND table_name = 'compendium_maneuvers') THEN

    ALTER TABLE compendium.compendium_maneuvers RENAME COLUMN maneuver_id TO ability_id;
    ALTER TABLE compendium.compendium_maneuvers RENAME TO compendium_abilities;
    ALTER INDEX IF EXISTS idx_compendium_maneuvers_entry_id RENAME TO idx_compendium_abilities_entry_id;

  END IF;
END $$;

-- ── skill_tree.node_grants: item_kind='maneuver' → 'ability', звузити CHECK.
UPDATE skill_tree.node_grants SET item_kind = 'ability' WHERE item_kind = 'maneuver';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'skill_tree' AND table_name = 'node_grants') THEN

    EXECUTE (
        SELECT COALESCE(string_agg(
                   format('ALTER TABLE skill_tree.node_grants DROP CONSTRAINT %I;', conname), ' '),
               'SELECT 1')
        FROM pg_constraint
        WHERE conrelid = 'skill_tree.node_grants'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%item_kind%'
    );

    ALTER TABLE skill_tree.node_grants
        ADD CONSTRAINT node_grants_item_kind_check
        CHECK (item_kind IN ('ability', 'spell', 'ability_collection', 'spell_collection'));

  END IF;
END $$;
