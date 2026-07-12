-- ================================================================
-- Maneuvers schema — GM-authored catalog of combat maneuvers/special actions
-- ================================================================
CREATE SCHEMA IF NOT EXISTS maneuvers;

CREATE TABLE IF NOT EXISTS maneuvers.entries (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL,
    name              VARCHAR(200) NOT NULL,
    duration_actions  SMALLINT     NOT NULL DEFAULT 1 CHECK (duration_actions BETWEEN 1 AND 3),
    description       TEXT,
    is_public         BOOLEAN      NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_user_id ON maneuvers.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_maneuvers_entries_public  ON maneuvers.entries(is_public) WHERE is_public = true;
