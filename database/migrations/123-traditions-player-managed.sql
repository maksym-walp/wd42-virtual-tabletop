-- ================================================================
-- Традиції заклинань більше не відкриває дерево розвитку — гравець сам
-- позначає, які традиції відкрито, у меню чарів персонажа.
--
-- character_sheet.characters.open_traditions — традиції
-- (spellbook.traditions.id), які гравець позначив відкритими; голий
-- cross-service масив uuid, як і колишній nodes.unlocks_traditions.
--
-- skill_tree.nodes.unlocks_traditions прибирається: вузли більше не
-- відкривають традиції. unlocks_complexity (складність заклинань)
-- лишається — драбина складності й далі відкривається деревом.
-- ================================================================

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS open_traditions UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE skill_tree.nodes
    DROP COLUMN IF EXISTS unlocks_traditions;
