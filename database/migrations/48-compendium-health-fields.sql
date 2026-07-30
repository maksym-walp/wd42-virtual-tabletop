-- ================================================================
-- Health dice for compendium: species/subspecies pick a hit-die rank
-- (d4..d20, GM's choice); an entry's health is that die rolled a number of
-- times derived from its body attribute — same body -> dice-count table the
-- frontend already uses for player characters (PHYSIQUE_HEALTH in
-- services/frontend/src/constants/characterSheet.js), reused here rather
-- than inventing a second scale for NPCs/creatures.
-- Also: `faction` is a new npc-only field (compendium_entries.history stays
-- but becomes creature-only, relabeled "Походження"/origin in the UI —
-- application-layer concern, not a schema change).
-- ================================================================

ALTER TABLE compendium.species
    ADD COLUMN IF NOT EXISTS health_die VARCHAR(3) NOT NULL DEFAULT 'd6'
        CHECK (health_die IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20'));

ALTER TABLE compendium.subspecies
    ADD COLUMN IF NOT EXISTS health_die VARCHAR(3) NOT NULL DEFAULT 'd6'
        CHECK (health_die IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20'));

ALTER TABLE compendium.compendium_entries
    ADD COLUMN IF NOT EXISTS faction VARCHAR(200);
