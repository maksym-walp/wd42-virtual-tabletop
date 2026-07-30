-- ================================================================
-- Lets a combatant be traced back to the compendium entry it was cloned
-- from (GM adds N instances of a bestiary/NPC entry to a combat scene).
-- Same convention as combatants.character_id: bare cross-schema UUID, no
-- FK, nullable (NULL for freeform manual NPCs and linked player characters).
-- ================================================================

ALTER TABLE campaigns.combatants
    ADD COLUMN IF NOT EXISTS compendium_entry_id UUID;

CREATE INDEX IF NOT EXISTS idx_combatants_compendium_entry_id
    ON campaigns.combatants(compendium_entry_id) WHERE compendium_entry_id IS NOT NULL;
