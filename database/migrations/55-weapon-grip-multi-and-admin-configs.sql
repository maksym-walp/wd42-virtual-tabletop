-- ================================================================
-- Дві незалежні зміни, застосовані разом:
--
-- 1. equipment.weapons.weapon_grip стає масивом — зброя може мати
--    одразу кілька особливостей (наприклад "одноручна або дворучна"),
--    а не рівно одну. CHECK-обмеження на weapon_type/weapon_grip
--    знімаються: набір допустимих значень тепер живе в
--    admin.site_configs і редагується з адмін-панелі, тож фіксований
--    список у CHECK більше не відповідає дійсності.
--
-- 2. Новий сервіс "admin" — конфіги сайту у вигляді key/value(jsonb).
--    Єдиний конфіг наразі: типи зброї (weapon_types) та особливості
--    зброї (weapon_grips), заповнені тими самими значеннями, що раніше
--    були захардкожені в constants/equipment.js — поведінка не
--    міняється, доки адмін щось не відредагує.
-- ================================================================

ALTER TABLE equipment.weapons DROP CONSTRAINT IF EXISTS weapons_weapon_type_check;
ALTER TABLE equipment.weapons DROP CONSTRAINT IF EXISTS weapons_weapon_grip_check;

ALTER TABLE equipment.weapons ALTER COLUMN weapon_type TYPE VARCHAR(50);

ALTER TABLE equipment.weapons
    ALTER COLUMN weapon_grip TYPE VARCHAR(50)[]
    USING (CASE WHEN weapon_grip IS NULL THEN NULL ELSE ARRAY[weapon_grip]::VARCHAR(50)[] END);

CREATE SCHEMA IF NOT EXISTS admin;

CREATE TABLE IF NOT EXISTS admin.site_configs (
    key         VARCHAR(50)  PRIMARY KEY,
    value       JSONB        NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO admin.site_configs (key, value) VALUES
    ('weapon_types', '[
        {"key":"melee","label":"Ближня"},
        {"key":"ranged","label":"Дальньобійна"},
        {"key":"thrown","label":"Метальна"},
        {"key":"universal","label":"Універсальна"},
        {"key":"other","label":"Інше"}
    ]'::jsonb),
    ('weapon_grips', '[
        {"key":"one_handed","label":"Одноручна"},
        {"key":"two_handed","label":"Дворучна"},
        {"key":"versatile","label":"Універсальна"},
        {"key":"other","label":"Інше"}
    ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
