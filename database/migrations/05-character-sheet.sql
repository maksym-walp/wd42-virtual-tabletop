-- ================================================================
-- Migration: add character_sheet schema + update skill_tree
-- Run once on existing installs
-- ================================================================
CREATE SCHEMA IF NOT EXISTS character_sheet;

CREATE TABLE IF NOT EXISTS character_sheet.characters (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID         NOT NULL,
    name                 VARCHAR(200) NOT NULL,
    archetype            VARCHAR(20)  NOT NULL
                         CHECK (archetype IN ('fighter', 'spellcaster', 'rogue')),
    race                 VARCHAR(20)  NOT NULL
                         CHECK (race IN ('human', 'gnome', 'dwarf', 'elf', 'sangvi', 'nephilim', 'other')),
    race_ancestry        VARCHAR(20)
                         CHECK (race_ancestry IS NULL OR race_ancestry IN
                           ('human','gnome','dwarf','elf','nephilim','other')),
    is_public            BOOLEAN      NOT NULL DEFAULT false,
    backstory            TEXT,
    notes                TEXT,
    current_hp           SMALLINT     NOT NULL DEFAULT 0,
    current_magic        SMALLINT     NOT NULL DEFAULT 0,
    heroic_actions_used  SMALLINT     NOT NULL DEFAULT 0,
    death_scale          SMALLINT     NOT NULL DEFAULT 3 CHECK (death_scale BETWEEN -3 AND 3),
    health_dice_values   INTEGER[]    NOT NULL DEFAULT '{}',
    conditions           JSONB        NOT NULL DEFAULT '[]',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_sheet.skills (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id   UUID        NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    skill_key      VARCHAR(50) NOT NULL
                   CHECK (skill_key IN (
                     'evasion','acrobatics','stealth','sleight_of_hand',
                     'strength','immunity','magic_sense','endurance',
                     'history','nature','erudition','mysticism',
                     'intuition','spellcasting','cleverness','perception',
                     'will','deception','artistry','persuasion'
                   )),
    value          SMALLINT    NOT NULL DEFAULT 1 CHECK (value BETWEEN 0 AND 12),
    progress_marks SMALLINT    NOT NULL DEFAULT 0 CHECK (progress_marks BETWEEN 0 AND 5),
    UNIQUE (character_id, skill_key)
);

CREATE TABLE IF NOT EXISTS character_sheet.known_spells (
    id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id   UUID     NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    spell_id       UUID     NOT NULL,
    mastered       BOOLEAN  NOT NULL DEFAULT false,
    cast_count     SMALLINT NOT NULL DEFAULT 0 CHECK (cast_count BETWEEN 0 AND 3),
    UNIQUE (character_id, spell_id)
);

CREATE TABLE IF NOT EXISTS character_sheet.tree_progress (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id   UUID        NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    node_id        UUID        NOT NULL,
    unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, node_id)
);

CREATE TABLE IF NOT EXISTS character_sheet.equipment (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id    UUID         NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slot            VARCHAR(20)  NOT NULL DEFAULT 'item'
                    CHECK (slot IN ('weapon','armor','artifact','item')),
    damage_die      VARCHAR(10),
    defense_value   SMALLINT,
    mastery_count   SMALLINT     NOT NULL DEFAULT 0,
    mastered        BOOLEAN      NOT NULL DEFAULT false,
    notes           TEXT
);

-- Migrate existing player_progress → tree_progress won't have character_id, so we drop it
DROP TABLE IF EXISTS skill_tree.player_progress;

ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS archetypes TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cs_characters_user     ON character_sheet.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_skills_character    ON character_sheet.skills(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_spells_character    ON character_sheet.known_spells(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_tree_character      ON character_sheet.tree_progress(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_equipment_character ON character_sheet.equipment(character_id);
