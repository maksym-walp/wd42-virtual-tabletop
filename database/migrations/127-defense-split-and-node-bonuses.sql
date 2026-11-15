-- ================================================================
-- Пасивний захист розкладається на три окремі поля замість єдиного
-- "Модифікатора" (character_sheet.characters.defense_bonus):
--   - "Обладунки"        — більше не ручне поле: підтягується автоматично
--                          з одягненого спорядження (equipment.defense_value),
--                          як і раніше.
--   - "Магічний захист"  — нове ручне поле (чари/зачарування).
--   - "Особливі умови"   — нове ручне поле + сума defense_bonus усіх
--                          відкритих вузлів дерева розвитку (нижче).
-- Стара колонка defense_bonus лишається (не видаляємо — уникаємо втрати
-- даних), але перестає читатись фронтом; значення переносимо в нове поле
-- "особливих умов", щоб наявні ручні модифікатори не зникли.
-- ================================================================

ALTER TABLE character_sheet.characters
    ADD COLUMN IF NOT EXISTS magic_defense_bonus   SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS special_defense_bonus SMALLINT NOT NULL DEFAULT 0;

UPDATE character_sheet.characters
   SET special_defense_bonus = defense_bonus
 WHERE defense_bonus IS DISTINCT FROM 0;

-- Вузлові бонуси: додаються автоматично при розблокуванні вузла.
--   luck_max_bonus — максимум вдачі пройдисвіта (+N при відкритті вузла).
--   defense_bonus  — пасивний захист, потрапляє в пул "особливих умов".
-- Назва "defense_bonus" повторює стару колонку characters навмисно — це
-- той самий сенс (плоский бонус до захисту), просто на рівні вузла.
ALTER TABLE skill_tree.nodes
    ADD COLUMN IF NOT EXISTS luck_max_bonus SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS defense_bonus  SMALLINT NOT NULL DEFAULT 0;
