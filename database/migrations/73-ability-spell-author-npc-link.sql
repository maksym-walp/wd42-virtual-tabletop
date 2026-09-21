-- ================================================================
-- "Автор" (лорне поле) для заклинань і вмінь:
--   - spellbook.spells вже мало lore_creator TEXT (вільний текст,
--     30-spell-nature-lore-components.sql) — додаємо необовʼязкове
--     посилання на конкретний НІП з бестіарію, якщо автор — реальний
--     персонаж, а не суто лорне імʼя.
--   - abilities.entries не мало жодного лорного поля автора взагалі —
--     додаємо і lore_creator, і те саме посилання на НІП, обидва
--     опціональні.
--
-- lore_creator_npc_id — "гола" крос-схемна UUID без FK (той самий
-- патерн, що й prerequisite_node_ids/compendium_equipment.equipment_id
-- тощо): вказує на compendium.compendium_entries.id з entity_type='npc'.
-- ================================================================

ALTER TABLE spellbook.spells
    ADD COLUMN IF NOT EXISTS lore_creator_npc_id UUID;

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS lore_creator TEXT,
    ADD COLUMN IF NOT EXISTS lore_creator_npc_id UUID;
