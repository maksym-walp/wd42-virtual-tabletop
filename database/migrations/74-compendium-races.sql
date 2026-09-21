-- ================================================================
-- "Раси та народи" — a second species-like taxonomy alongside
-- compendium.species/subspecies (44-compendium-service.sql), structurally
-- identical (created_by/is_public/name/description ownership pattern) but
-- with no health_die (races/peoples don't drive health dice the way
-- species/subspecies do) and peoples carry an extra `origin` field.
-- compendium_entries gets its own race_id/people_id pair, independent of
-- species_id/subspecies_id — an entry can be classified along both axes.
-- ================================================================

CREATE TABLE IF NOT EXISTS compendium.races (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,              -- auth.users.id, cross-schema, no FK
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_races_created_by ON compendium.races(created_by);
CREATE INDEX IF NOT EXISTS idx_races_is_public  ON compendium.races(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS compendium.peoples (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id     UUID         NOT NULL REFERENCES compendium.races(id) ON DELETE CASCADE,
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    origin      TEXT,                                -- "Походження народу"
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peoples_race_id    ON compendium.peoples(race_id);
CREATE INDEX IF NOT EXISTS idx_peoples_created_by ON compendium.peoples(created_by);
CREATE INDEX IF NOT EXISTS idx_peoples_is_public  ON compendium.peoples(is_public) WHERE is_public = true;

ALTER TABLE compendium.compendium_entries
    ADD COLUMN IF NOT EXISTS race_id   UUID REFERENCES compendium.races(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS people_id UUID REFERENCES compendium.peoples(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entries_race_id   ON compendium.compendium_entries(race_id);
CREATE INDEX IF NOT EXISTS idx_entries_people_id ON compendium.compendium_entries(people_id);
