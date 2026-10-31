-- ================================================================
-- Журнал бою: кожен автоматичний кидок має бути видимим і зрозумілим тому,
-- кого він стосується. Атакувальник бачить результат одразу модалкою, а
-- ціль (інший гравець за іншим екраном) — саме з цього журналу, бо інакше
-- в неї просто мовчки зникає здоров'я.
--
-- payload тримає повну розбивку кроку: формулу, що випало на кожному кубику,
-- з чим порівняно, скільки знято зношуванням, скільки поглинув пасивний
-- захист і які джерела дали перевагу чи перешкоду. Бекенд його не
-- інтерпретує — лише зберігає й віддає.
--
-- is_gm_only — запис стосується прихованого комбатанта (is_hidden), тож
-- гравцям не віддається: та сама логіка, що й redactForPlayers для рядків
-- таблиці, аби журнал не розкривав те, що ховає таблиця.
-- ================================================================

CREATE TABLE IF NOT EXISTS campaigns.combat_log_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combat_scene_id     UUID NOT NULL REFERENCES campaigns.combat_scenes(id) ON DELETE CASCADE,
    round_number        INTEGER NOT NULL DEFAULT 1,
    -- Комбатанта можуть прибрати зі сцени, а запис журналу про нього має
    -- лишитися читабельним, тому FK з SET NULL і денормалізовані імена.
    actor_combatant_id  UUID REFERENCES campaigns.combatants(id) ON DELETE SET NULL,
    target_combatant_id UUID REFERENCES campaigns.combatants(id) ON DELETE SET NULL,
    actor_name          VARCHAR(200),
    target_name         VARCHAR(200),
    kind                VARCHAR(20) NOT NULL
        CHECK (kind IN ('attack', 'dodge', 'initiative', 'death_save', 'damage')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_gm_only          BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_combat_log_scene
    ON campaigns.combat_log_entries (combat_scene_id, created_at DESC);
