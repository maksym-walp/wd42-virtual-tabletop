-- ================================================================
-- Прибираються альтернативні форми (kind='alternative') — лишається
-- лише рівнева структура: 'primitive' (Обмежена), основна форма запису
-- (Повноцінна), 'perfected' (Довершена). Стосується і заклинань, і
-- вмінь. Замість названих варіантів-форм — окреме посилання на інший,
-- самостійно заповнений запис (міграція 118, «рівноцінні/альтернативні»).
--
-- Руйнівно для наявних альтернативних форм — прийнятно: база лише
-- локальна/девелоперська, збереження цих даних не потрібне.
--
-- main_form_name мав сенс лише для альтернативного режиму (назва
-- основної форми серед варіантів) — прибирається разом з режимом.
-- primary_form/mastered_forms на листі персонажа відстежували, яку
-- альтернативну форму гравець обрав і які освоїв — цей вибір більше не
-- існує, form_tier і далі відстежує рівневий прогрес без змін.
-- ================================================================

UPDATE spellbook.spells
SET forms = (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
  FROM jsonb_array_elements(forms) f
  WHERE f->>'kind' <> 'alternative'
)
WHERE forms <> '[]'::jsonb;

UPDATE abilities.entries
SET forms = (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
  FROM jsonb_array_elements(forms) f
  WHERE f->>'kind' <> 'alternative'
)
WHERE forms <> '[]'::jsonb;

ALTER TABLE spellbook.spells DROP COLUMN IF EXISTS main_form_name;
ALTER TABLE abilities.entries DROP COLUMN IF EXISTS main_form_name;

ALTER TABLE character_sheet.known_spells
    DROP COLUMN IF EXISTS primary_form,
    DROP COLUMN IF EXISTS mastered_forms;

ALTER TABLE character_sheet.abilities
    DROP COLUMN IF EXISTS primary_form,
    DROP COLUMN IF EXISTS mastered_forms;

COMMENT ON COLUMN skill_tree.node_grants.form_key IS
  'Яку форму вміння/заклинання вузол видає чи робить доступною: NULL — усі '
  'форми; інакше ключ форми (''main'', ''primitive'' або ''perfected''). '
  'Альтернативних форм (uuid-ключів) більше не існує — міграція 117. Для '
  'колекцій завжди NULL.';
