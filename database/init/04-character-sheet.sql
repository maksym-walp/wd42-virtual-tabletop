-- ================================================================
-- Character Sheet schema
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
    -- Current vitals (updated during play)
    current_hp           SMALLINT     NOT NULL DEFAULT 0,
    current_magic        SMALLINT     NOT NULL DEFAULT 0,
    heroic_actions_used  SMALLINT     NOT NULL DEFAULT 0,
    -- Death scale: NULL = not set, positive = successes, negative = failures
    death_scale          SMALLINT
                         CHECK (death_scale IS NULL OR death_scale BETWEEN -3 AND 3),
    -- Development points budget (assigned by GM or earned)
    dev_points           SMALLINT     NOT NULL DEFAULT 0,
    -- Health dice rolled values, sorted ASC (length = dice count from physique level)
    health_dice_values   INTEGER[]    NOT NULL DEFAULT '{}',
    -- [{type: 'exhaustion'|'injury'|'illness'|'poison'|'trauma', level: N}]
    conditions           JSONB        NOT NULL DEFAULT '[]',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 20 skills per character (all start at 1 on creation)
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

-- Known spells — references spellbook.spells.id
CREATE TABLE IF NOT EXISTS character_sheet.known_spells (
    id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id   UUID     NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    spell_id       UUID     NOT NULL,
    mastered       BOOLEAN  NOT NULL DEFAULT false,
    cast_count     SMALLINT NOT NULL DEFAULT 0 CHECK (cast_count BETWEEN 0 AND 3),
    UNIQUE (character_id, spell_id)
);

-- Skill tree node unlocks per character (replaces skill_tree.player_progress)
CREATE TABLE IF NOT EXISTS character_sheet.tree_progress (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id   UUID        NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    node_id        UUID        NOT NULL,
    unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, node_id)
);

-- Equipment: weapons, armor, artifacts, misc items
CREATE TABLE IF NOT EXISTS character_sheet.equipment (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id    UUID         NOT NULL REFERENCES character_sheet.characters(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slot            VARCHAR(20)  NOT NULL DEFAULT 'item'
                    CHECK (slot IN ('weapon','armor','artifact','item')),
    damage_die      VARCHAR(10),   -- 'd4','d6','d8','d10','d12' (weapons)
    defense_value   SMALLINT,      -- passive defense value (armor)
    mastery_count   SMALLINT      NOT NULL DEFAULT 0, -- towards weapon mastery (0-3)
    mastered        BOOLEAN       NOT NULL DEFAULT false,
    notes           TEXT
);

-- Remove player_progress from skill_tree (now per-character in character_sheet)
DROP TABLE IF EXISTS skill_tree.player_progress;

-- Add archetype filter to skill_tree nodes (empty = available to all archetypes)
ALTER TABLE skill_tree.nodes
  ADD COLUMN IF NOT EXISTS archetypes TEXT[] NOT NULL DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cs_characters_user     ON character_sheet.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_skills_character    ON character_sheet.skills(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_spells_character    ON character_sheet.known_spells(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_tree_character      ON character_sheet.tree_progress(character_id);
CREATE INDEX IF NOT EXISTS idx_cs_equipment_character ON character_sheet.equipment(character_id);
