-- ================================================================
-- Стани персонажа (conditions) і валюти (currencies) стають
-- редагованими з адмін-панелі (admin.site_configs). character-sheet
-- віддає їх усім автентифікованим через GET /api/characters/config;
-- фронтенд має ті самі значення як запасні (constants/characterSheet.js).
--
-- conditions:  [{ key, label, description, max_level }]
--   key — значення type у character_sheet.characters.conditions.
-- currencies:  [{ key, label, description, convertible, rate,
--                 high: { key, name, metal }, low: { key, name, metal } }]
--   high.key/low.key — ключі в character_sheet.characters.money.
-- ================================================================

INSERT INTO admin.site_configs (key, value) VALUES
    ('conditions', '[
        {"key":"exhaustion","label":"Втома","description":"","max_level":6},
        {"key":"injury","label":"Поранення","description":"","max_level":null},
        {"key":"illness","label":"Хвороба","description":"","max_level":null},
        {"key":"poison","label":"Отруєння","description":"","max_level":null},
        {"key":"trauma","label":"Серйозна травма","description":"","max_level":null}
    ]'::jsonb),
    ('currencies', '[
        {"key":"great_arbor","label":"Великий Арбор","description":"","convertible":true,"rate":100,
         "high":{"key":"alios","name":"Альґос","metal":"золото"},
         "low":{"key":"delios","name":"Дельґос","metal":"срібло"}},
        {"key":"three_crowns","label":"Трикоронний монетний договір","description":"","convertible":true,"rate":100,
         "high":{"key":"asim","name":"Асім","metal":"золото"},
         "low":{"key":"bronvit","name":"Бронвіт","metal":"бронза"}},
        {"key":"karif","label":"Карифське царство","description":"","convertible":true,"rate":100,
         "high":{"key":"tezar","name":"Тезар","metal":"бронза"},
         "low":{"key":"kuprum","name":"Купрум","metal":"бронза"}},
        {"key":"davlaria","label":"Давларія","description":"","convertible":true,"rate":100,
         "high":{"key":"velykyi_tong","name":"Великий Тонг","metal":"бронза"},
         "low":{"key":"malyi_tong","name":"Малий Тонг","metal":"бронза"}},
        {"key":"other","label":"Інші","description":"","convertible":false,"rate":null,
         "high":{"key":"infernalne_zoloto","name":"Інфернальне золото","metal":null},
         "low":{"key":"samotsvity","name":"Самоцвіти","metal":"у золоті"}}
    ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
