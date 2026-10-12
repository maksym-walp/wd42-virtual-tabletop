-- ================================================================
-- Налаштування вигляду дерева розвитку — окремо для кожної вкладки
-- (skill_tree.nodes.archetype: fighter / spellcaster / rogue).
--
--   * background_url — фонове зображення дерева (/uploads/...), NULL = без фону;
--   * layout — розкладка вузлів: 'tree' (класичне, корінь знизу) або
--     'star' (корінь у центрі, гілки розходяться променями).
--
-- Вкладки не мають власної таблиці, тож налаштування живуть окремо від
-- skill_tree.nodes: імпорт дерева (DELETE FROM nodes WHERE archetype)
-- їх не зачіпає. Відсутній рядок = { layout: 'tree', background_url: NULL }.
-- ================================================================

CREATE TABLE IF NOT EXISTS skill_tree.archetype_settings (
  archetype      VARCHAR(50) PRIMARY KEY,
  background_url VARCHAR(500),
  layout         VARCHAR(10) NOT NULL DEFAULT 'tree' CHECK (layout IN ('tree', 'star')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
