-- ================================================================
-- Spellbook schema
-- ================================================================
CREATE SCHEMA IF NOT EXISTS spellbook;

CREATE TABLE IF NOT EXISTS spellbook.spells (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL,
    name            VARCHAR(200) NOT NULL,
    magic_type      VARCHAR(20)  NOT NULL
                    CHECK (magic_type IN ('arcana','elemental','integral','infernal','blight')),
    mechanical_desc TEXT,
    narrative_desc  TEXT,
    energy_cost     INTEGER      NOT NULL DEFAULT 0 CHECK (energy_cost >= 0),
    action_time     INTEGER      NOT NULL DEFAULT 1 CHECK (action_time BETWEEN 1 AND 3),
    ritual          VARCHAR(20)  NOT NULL DEFAULT 'impossible'
                    CHECK (ritual IN ('impossible','possible','required')),
    duration_value  INTEGER,
    duration_unit   VARCHAR(20)  NOT NULL DEFAULT 'instant'
                    CHECK (duration_unit IN ('instant','seconds','minutes','hours','days','permanent')),
    range_desc      VARCHAR(200),
    components      TEXT[]       NOT NULL DEFAULT '{}',
    is_public       BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spells_user_id    ON spellbook.spells(user_id);
CREATE INDEX IF NOT EXISTS idx_spells_magic_type ON spellbook.spells(magic_type);
CREATE INDEX IF NOT EXISTS idx_spells_public     ON spellbook.spells(is_public) WHERE is_public = true;
