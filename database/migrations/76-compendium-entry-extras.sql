-- ================================================================
-- Two more NPC-only fields on compendium_entries:
--   health_die_override — lets an NPC pick its own health die instead of
--     always inheriting one from its species/subspecies (or falling back
--     to d6 when neither is set). Still nullable/optional: when unset, the
--     existing species/subspecies inheritance chain in entry.model.js's
--     HEALTH_DIE_SELECT keeps working exactly as before.
--   private_notes — GM-only lore/notes, never shown to a viewer who is
--     neither the entry's creator nor a game_master/admin (enforced in
--     entry.controller.js, not by row visibility — the entry itself can
--     still be public).
-- Both nullable, cleared server-side for entity_type='creature', same
-- pattern as motivation/backstory/faction/age/gender.
-- ================================================================

ALTER TABLE compendium.compendium_entries
    ADD COLUMN IF NOT EXISTS health_die_override VARCHAR(3) CHECK (health_die_override IS NULL OR health_die_override IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')),
    ADD COLUMN IF NOT EXISTS private_notes TEXT;
