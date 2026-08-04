-- ================================================================
-- thumbnail_url для каталогу спорядження. Медіа-сервіс тепер повертає при
-- завантаженні пару посилань (image_url — оригінал, thumbnail_url —
-- стиснута 400px webp-копія); каталогу потрібне місце зберегти другий URL,
-- щоб списки/картки могли тягнути мініатюру замість оригіналу.
--
-- Додається до всіх чотирьох таблиць-видів (items/weapons/armor/artifacts) —
-- ті самі таблиці, що вже несуть image_url з 28-catalog-image-url.sql та
-- 39/51-equipment-*.sql.
-- ================================================================

ALTER TABLE equipment.items     ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);
ALTER TABLE equipment.weapons   ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);
ALTER TABLE equipment.armor     ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);
ALTER TABLE equipment.artifacts ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);
