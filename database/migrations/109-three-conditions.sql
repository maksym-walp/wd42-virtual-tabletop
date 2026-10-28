-- ================================================================
-- Лише три стани: fatigue (Втома), illness (Хвороба), trauma (Травма),
-- рівні 1–5 (у даних допустимо до 9: 6-й рівень — непритомність, кожен
-- наступний зсуває шкалу смерті на −1). Ефекти рівнів — у character-sheet
-- (src/rules/conditions.js), адмін редагує лише назву й опис.
--
-- Відображення старих ключів characters.conditions ([{ type, level }]):
--   exhaustion        → fatigue
--   illness, poison   → illness
--   injury, trauma    → trauma   (+ skill_keys: [] — навички пошкодженої частини тіла)
-- Рівні, що зливаються, складаються; результат обрізається до 5 (так само
-- й одиночні рівні вище 5, напр. колишня Втома 6). Невідомі типи відкидаються.
-- NOT idempotent — must run exactly once (старі ключі зникають).
-- ================================================================

-- Описи, які адмін уже встиг заповнити для відповідних старих станів.
WITH old AS (
    SELECT elem->>'key' AS key, COALESCE(elem->>'description', '') AS description
    FROM admin.site_configs, jsonb_array_elements(value) elem
    WHERE site_configs.key = 'conditions'
)
INSERT INTO admin.site_configs (key, value, updated_at)
SELECT 'conditions', jsonb_build_array(
    jsonb_build_object('key', 'fatigue', 'label', 'Втома', 'max_level', 5,
        'description', COALESCE(NULLIF((SELECT description FROM old WHERE key = 'exhaustion'), ''),
            'Накопичується від тривалої діяльності без відпочинку (таймер діяльності) і знімається відпочинком.')),
    jsonb_build_object('key', 'illness', 'label', 'Хвороба', 'max_level', 5,
        'description', COALESCE(NULLIF((SELECT description FROM old WHERE key = 'illness'), ''),
            'Хвороби, отруєння та інші недуги тіла.')),
    jsonb_build_object('key', 'trauma', 'label', 'Травма', 'max_level', 5,
        'description', COALESCE(NULLIF((SELECT description FROM old WHERE key = 'trauma'), ''),
            'Поранення певної частини тіла; впливає на повʼязані з нею навички.'))
), NOW()
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

WITH mapped AS (
    SELECT c.id,
           CASE elem->>'type'
               WHEN 'exhaustion' THEN 'fatigue'
               WHEN 'fatigue'    THEN 'fatigue'
               WHEN 'illness'    THEN 'illness'
               WHEN 'poison'     THEN 'illness'
               WHEN 'injury'     THEN 'trauma'
               WHEN 'trauma'     THEN 'trauma'
           END AS type,
           GREATEST(0, COALESCE((elem->>'level')::int, 0)) AS level
    FROM character_sheet.characters c, jsonb_array_elements(c.conditions) elem
    WHERE jsonb_typeof(c.conditions) = 'array'
),
merged AS (
    SELECT id, type, LEAST(SUM(level), 5)::int AS level
    FROM mapped
    WHERE type IS NOT NULL
    GROUP BY id, type
    HAVING SUM(level) > 0
)
UPDATE character_sheet.characters c
   SET conditions = COALESCE((
         SELECT jsonb_agg(
                  CASE WHEN m.type = 'trauma'
                       THEN jsonb_build_object('type', m.type, 'level', m.level, 'skill_keys', '[]'::jsonb)
                       ELSE jsonb_build_object('type', m.type, 'level', m.level)
                  END
                  ORDER BY array_position(ARRAY['fatigue','illness','trauma'], m.type))
         FROM merged m WHERE m.id = c.id
       ), '[]'::jsonb)
 WHERE c.conditions IS DISTINCT FROM '[]'::jsonb;
