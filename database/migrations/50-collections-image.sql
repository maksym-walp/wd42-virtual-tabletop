-- Collections gain an optional image, same VARCHAR(500) shape every other
-- catalog entry already uses (equipment.items, artifacts.entries,
-- spellbook.spells, compendium_entries, ... — see 28-catalog-image-url.sql) —
-- shown on the collection's card and detail page alongside its name/description.
ALTER TABLE equipment.collections  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE artifacts.collections  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE abilities.collections  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE maneuvers.collections  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE spellbook.collections  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE compendium.collections ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
