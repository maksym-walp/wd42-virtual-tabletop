-- ================================================================
-- Заклинання: складність і рівні.
--
-- complexity — наскільки заклинання складне у виконанні:
--   primitive (Примітивне), simple (Просте), medium (Середнє),
--   complex (Комплексне), extreme (Надзвичайно складне).
-- NULL — не вказано (усі наявні заклинання до цієї міграції).
--
-- levels — рівні заклинання як хронологічні версії. Колонки самого рядка
-- spellbook.spells — це рівень 1; levels містить рівні 2..N у порядку
-- зростання, кожен — повний знімок полів, що можуть змінюватися між
-- версіями (див. normalizeLevels у services/spellbook/src/models/spell.model.js):
-- complexity, spell_kind, energy_cost, action_time, ritual, duration_value,
-- duration_unit, range_desc, components, mechanical_desc, narrative_desc,
-- lore_creator, lore_creator_npc_id.
-- Назва, природа, зображення, видимість, традиції, колекції та вимоги
-- дерева розвитку спільні для всіх рівнів.
-- ================================================================

ALTER TABLE spellbook.spells
    ADD COLUMN IF NOT EXISTS complexity TEXT
        CHECK (complexity IN ('primitive', 'simple', 'medium', 'complex', 'extreme')),
    ADD COLUMN IF NOT EXISTS levels JSONB NOT NULL DEFAULT '[]';
