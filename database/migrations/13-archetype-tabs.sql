-- ================================================================
-- Migration: archetype-specific character sheet tabs
--   - Fighter:     Маневри (custom combat maneuvers, mirrors equipment)
--   - Spellcaster: Ритуали (ritual progress tracker, per-participant/round)
--   - Rogue:       Вдача + Ігрове натхнення (given to another player)
-- ================================================================

CREATE TABLE IF NOT EXISTS character_sheet.maneuvers (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id     UUID         NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    name             VARCHAR(200) NOT NULL,
    duration_actions SMALLINT     NOT NULL DEFAULT 1 CHECK (duration_actions BETWEEN 1 AND 3),
    description      TEXT
);

-- participants: [{"name": "...", "successes": [true, false, ...]}] — one
-- boolean per round, length kept in sync with `rounds` by the application.
CREATE TABLE IF NOT EXISTS character_sheet.ritual_trackers (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID         NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    rounds       SMALLINT     NOT NULL DEFAULT 3 CHECK (rounds BETWEEN 1 AND 12),
    participants JSONB        NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE character_sheet.characters
  ADD COLUMN IF NOT EXISTS luck_current SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS luck_max SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rogue_inspiration_die VARCHAR(10),
  ADD COLUMN IF NOT EXISTS rogue_inspiration_given_to VARCHAR(200);
