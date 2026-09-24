-- ================================================================
-- Вміння: один опис розділяється на два поля, за тим самим взірцем, що й
-- заклинання (spellbook.spells.mechanical_desc / narrative_desc) —
-- механічний опис (що відбувається в грі) і наративний опис (як це
-- виглядає/відчувається у світі гри) редагуються й показуються окремо.
--
-- Наявний description переноситься в mechanical_desc: поле й раніше було
-- підписане як "Що відбувається механічно, коли персонаж використовує це
-- вміння..." — тобто вже за змістом було механічним описом.
-- ================================================================

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS mechanical_desc TEXT,
    ADD COLUMN IF NOT EXISTS narrative_desc TEXT;

UPDATE abilities.entries SET mechanical_desc = description WHERE mechanical_desc IS NULL;

ALTER TABLE abilities.entries DROP COLUMN IF EXISTS description;
