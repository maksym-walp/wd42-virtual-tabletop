-- ================================================================
-- image_crop — кадрування зображень записів під форму карток. Користувач
-- обирає кадр (react-easy-crop на фронтенді), а файл лишається незмінним:
-- зберігаємо лише центр кадру (x/y, % від зображення), наближення (zoom) і
-- пропорції оригіналу (ratio), з яких фронтенд будує кадр під будь-яку форму
-- (4:3 картки, 16:9 прев'ю, квадратний портрет). NULL — показ по центру,
-- як було досі. Формат валідує utils/image-crop.js кожного сервісу.
-- ================================================================

ALTER TABLE character_sheet.characters    ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE spellbook.spells              ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE spellbook.collections         ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE abilities.entries             ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE abilities.collections         ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE equipment.items               ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE equipment.weapons             ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE equipment.armor               ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE equipment.artifacts           ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE equipment.collections         ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE compendium.compendium_entries ADD COLUMN IF NOT EXISTS image_crop JSONB;
ALTER TABLE compendium.collections        ADD COLUMN IF NOT EXISTS image_crop JSONB;
