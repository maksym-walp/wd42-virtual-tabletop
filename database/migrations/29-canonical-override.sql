-- ================================================================
-- Явний прапорець is_canonical поверх похідного "автор = admin".
-- Дозволяє game_master/admin позначити канонічним запис, що належить
-- іншому користувачу, не змінюючи власника (кнопка "Зробити канонічним").
-- Кінцевий статус is_canonical для читання завжди рахується як
-- (роль автора IN admin/game_master) OR (цей прапорець) — див. моделі.
-- ================================================================

ALTER TABLE equipment.items       ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE equipment.collections ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE spellbook.spells      ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE spellbook.collections ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE abilities.entries     ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE abilities.collections ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE maneuvers.entries     ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE maneuvers.collections ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE artifacts.entries     ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE artifacts.collections ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;
