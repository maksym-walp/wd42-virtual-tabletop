-- ================================================================
-- Combat Tracker: GM-run initiative tracker scoped to a campaign.
--   combat_scenes  — one battle map/background + round counter.
--   combatants     — creatures in that scene; character_id is a plain
--                    cross-schema UUID (character_sheet.characters),
--                    NULL for GM-authored custom NPCs. Mirrors the
--                    no-FK cross-schema convention used by
--                    campaign_characters.character_id.
-- "Current" scene = the most recently created one for the campaign;
-- old scenes stay in the table as history once a new one is created.
-- ================================================================

CREATE TABLE IF NOT EXISTS campaigns.combat_scenes (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID         NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    round_number INTEGER      NOT NULL DEFAULT 1,
    image_url    VARCHAR(500),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_scenes_campaign_id ON campaigns.combat_scenes(campaign_id);

CREATE TABLE IF NOT EXISTS campaigns.combatants (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    combat_scene_id      UUID         NOT NULL REFERENCES campaigns.combat_scenes(id) ON DELETE CASCADE,
    character_id         UUID,
    name                 VARCHAR(200) NOT NULL,
    passive_defense      SMALLINT,
    active_defense       SMALLINT,
    health               SMALLINT,
    initiative           INTEGER,
    notes                TEXT,
    description          TEXT,
    is_hidden            BOOLEAN      NOT NULL DEFAULT false,
    has_acted_this_round BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combatants_combat_scene_id ON campaigns.combatants(combat_scene_id);
