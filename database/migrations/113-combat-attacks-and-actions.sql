-- ================================================================
-- Атаки в бойовій сцені й трекер дій.
--
-- reaction_reserved — комбатант лишив дію на реакцію (розділ 4.5). Для
--   трекера це ще й «буде ухилятися»: перша вхідна атака автоматично кидає
--   його кубик Ухилення, пише результат в active_defense і знімає прапорець.
--   Активний захист діє до початку наступного ходу комбатанта (4.5.1), тому
--   прапорець переживає раунд і знімається лише використанням.
--
-- actions_used / actions_log — скільки дій витрачено цього ходу і яких саме
--   типів. actions_log потрібен правилу 4.10 (повторення дій): друга однакова
--   дія за хід — з перешкодою, третя — з подвійною. Обидва скидає
--   POST /combat/next-round разом з has_acted_this_round.
--
-- attack_die / damage_die — для «ручних» НІПів, яких ГМ набив числами і які
--   не мають запису в npcs/bestiary (у тих кубики виводяться зі стат-блоку).
-- ================================================================

ALTER TABLE campaigns.combatants
    ADD COLUMN IF NOT EXISTS reaction_reserved BOOLEAN  NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS actions_used      SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actions_log       TEXT[]   NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS attack_die        VARCHAR(10),
    ADD COLUMN IF NOT EXISTS damage_die        VARCHAR(10);
