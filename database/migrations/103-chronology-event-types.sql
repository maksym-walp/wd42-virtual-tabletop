-- ================================================================
-- Хронологія: типи подій з кольорами, що задаються в адмін-панелі.
--
-- event_types (admin.site_configs): [{ key, label, color }] — адмін сам
-- вказує, які бувають типи подій і який колір відповідає кожному. Подія
-- посилається на тип за key (calendar_events.event_type); колір події
-- береться з її типу під час читання (ChronologyEventModel), тож зміна
-- кольору типу одразу перефарбовує всі його події. Власний колір події
-- (calendar_events.color) лишається запасним — для подій без типу або з
-- типом, якого вже нема в конфігу.
-- ================================================================

ALTER TABLE chronology.calendar_events
    ADD COLUMN IF NOT EXISTS event_type TEXT;

INSERT INTO admin.site_configs (key, value) VALUES
    ('event_types', '[
        {"key":"battle","label":"Битва","color":"#d9534f"},
        {"key":"political","label":"Політична подія","color":"#3b82f6"},
        {"key":"magic","label":"Магічна подія","color":"#8e5bd0"},
        {"key":"celebration","label":"Свято","color":"#e0a020"},
        {"key":"disaster","label":"Катастрофа","color":"#e67e22"},
        {"key":"discovery","label":"Відкриття","color":"#1abc9c"},
        {"key":"other","label":"Інше","color":"#607d8b"}
    ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
