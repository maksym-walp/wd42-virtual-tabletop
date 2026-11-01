-- ================================================================
-- Журнал бою отримує новий вид запису: 'cast' — каст бойового
-- заклинання (POST /:id/combat/cast), той самий payload-підхід, що й
-- 'attack', але джерело — заклинання, а не зброя.
--
-- Жодних нових колонок на campaigns.combatants не додається: магічна
-- енергія й далі лишається виключно на character_sheet.characters.
-- current_magic (campaigns її не дублює) — кастування доступне лише
-- гравцевим персонажам, бо лише в них є known_spells.
-- ================================================================

ALTER TABLE campaigns.combat_log_entries DROP CONSTRAINT IF EXISTS combat_log_entries_kind_check;
ALTER TABLE campaigns.combat_log_entries
    ADD CONSTRAINT combat_log_entries_kind_check
    CHECK (kind IN ('attack', 'dodge', 'initiative', 'death_save', 'damage', 'cast'));
