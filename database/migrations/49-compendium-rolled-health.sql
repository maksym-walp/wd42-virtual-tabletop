-- ================================================================
-- Persistent rolled health for NPCs: a GM rolls the entry's health-dice
-- pool once (see entry.dto.js `health.formula`) and the result is stored
-- here, so it survives across sessions and is what the campaigns combat
-- tracker pulls when cloning this NPC into a combat scene — instead of
-- recomputing the deterministic average every time (which creatures still
-- do; creatures have no persistent health of their own).
-- ================================================================

ALTER TABLE compendium.compendium_entries
    ADD COLUMN IF NOT EXISTS rolled_health SMALLINT
        CHECK (rolled_health IS NULL OR rolled_health >= 1);
