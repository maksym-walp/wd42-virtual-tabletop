-- ================================================================
-- Доступність заклинань через дерево розвитку — не через окремі
-- заклинання, а через традиції та складність.
--
-- skill_tree.nodes:
--   unlocks_traditions — традиції (spellbook.traditions.id), які відкриває
--                        вузол; голі cross-service uuid без FK, як
--                        node_grants.item_id;
--   unlocks_complexity — найвища складність заклинань, яку відкриває вузол
--                        (драбина: відкриває й усі нижчі); NULL — жодної.
--
-- Заклинання доступне персонажу, коли відкрито хоч одну з його традицій
-- (без традицій — умова не діє) І складність форми не вища за найвищу
-- відкриту (без складності — умова не діє). Форми перевіряються окремо —
-- кожна за власною складністю. Перевіряє character-sheet.
--
-- Майстер (роль game_master/admin або ГМ кампанії персонажа) додає
-- заклинання поза цими правилами: known_spells.gm_granted = true, і
-- такий запис правила доступності не обмежують і надалі.
--
-- Прибирається стара прив'язка заклинань до вузлів: вузли більше не
-- видають / не відкривають окремі заклинання чи їхні колекції, а в
-- заклинань (і колекцій заклинань) немає власних вимог-вузлів.
-- ================================================================

ALTER TABLE skill_tree.nodes
    ADD COLUMN IF NOT EXISTS unlocks_traditions UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS unlocks_complexity TEXT
        CHECK (unlocks_complexity IN ('primitive', 'simple', 'medium', 'complex', 'extreme'));

ALTER TABLE character_sheet.known_spells
    ADD COLUMN IF NOT EXISTS gm_granted BOOLEAN NOT NULL DEFAULT false;

DELETE FROM skill_tree.node_grants WHERE item_kind IN ('spell', 'spell_collection', 'maneuver');
ALTER TABLE skill_tree.node_grants DROP CONSTRAINT IF EXISTS node_grants_item_kind_check;
ALTER TABLE skill_tree.node_grants
    ADD CONSTRAINT node_grants_item_kind_check CHECK (item_kind IN ('ability', 'ability_collection'));

DROP INDEX IF EXISTS spellbook.idx_spellbook_spells_prereq_nodes;
ALTER TABLE spellbook.spells
    DROP COLUMN IF EXISTS prerequisite_node_ids,
    DROP COLUMN IF EXISTS prerequisite_logic;

-- Колонки лишаються (спільна модель колекцій), але вимоги-вузли для
-- колекцій заклинань більше не задаються й не діють.
UPDATE spellbook.collections SET prerequisite_node_ids = '{}', prerequisite_logic = 'or'
 WHERE cardinality(prerequisite_node_ids) > 0;
