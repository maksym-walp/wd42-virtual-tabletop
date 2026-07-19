-- ================================================================
-- image_url для трьох каталогів, які його не мали. equipment.items та
-- artifacts.entries вже несуть цю колонку (див. 15/24), тож після цієї
-- міграції всі п'ять каталогів однорідні й спільний <ImageUploadField>
-- працює скрізь однаково.
-- ================================================================

ALTER TABLE spellbook.spells  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE maneuvers.entries ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE abilities.entries ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
