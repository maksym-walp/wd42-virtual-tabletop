// Attribute (1-6) -> die size: the same ladder compendium uses for its own
// skill dice (services/compendium/src/dto/entry.dto.js ATTRIBUTE_DICE_RANK),
// which is in turn the frontend's AGILITY_INITIATIVE table — dexterity's die
// already doubles as a player's initiative/evasion die, so reusing it here
// for compendium-cloned combatants keeps both systems on the same scale.
const ATTRIBUTE_DIE_SIZE = { 1: 4, 2: 6, 3: 8, 4: 10, 5: 12, 6: 20 };

// health_die is a species/subspecies-authored rank (d4..d20), resolved by
// campaigns.model.js's findCompendiumEntry the same way compendium resolves
// it for its own entry.health field.
const HEALTH_DIE_SIZE = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

// Health-dice count per body attribute — the exact same table compendium's
// own entry.dto.js uses (HEALTH_DICE_COUNT_BY_BODY), itself reused from the
// frontend's player-character PHYSIQUE_HEALTH table. Kept in sync by hand
// since services share no code, only the database.
const HEALTH_DICE_COUNT_BY_BODY = { 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 };

function dieAverage(size) {
  return (size + 1) / 2;
}

// Deterministic starting combat numbers derived from a compendium entry.
// Same formula for every cloned instance of one add (a monster stat block
// has one set of starting numbers, not per-instance dice variance) — the GM
// can hand-adjust any row afterward like any other combatant. activeDefense
// mirrors a player's passive-style defense baseline (10 + a die average, no
// swingy d20 roll baked in); initiative is the dexterity die's average,
// matching how dexterity already drives the initiative die for players.
//
// maxHealth: an NPC's health is rolled once in the compendium and persists
// (compendium EntryModel.updateRolledHealth) — cloning it into combat pulls
// that stored number directly, so every clone (and every future re-add)
// shows the same HP the GM actually rolled for that character, not a
// re-derived average. A creature has no persistent health of its own
// (rolled_health is always null for it), so it keeps recomputing the
// average from its health-dice pool (health_die × body-derived count) on
// every clone, same as before this NPC/creature split was introduced.
function deriveCombatStats({ body, dexterity, health_die: healthDie, entity_type: entityType, rolled_health: rolledHealth }) {
  const dexDie = ATTRIBUTE_DIE_SIZE[dexterity] || ATTRIBUTE_DIE_SIZE[1];
  const hpDieSize = HEALTH_DIE_SIZE[healthDie] || HEALTH_DIE_SIZE.d6;
  const hpDiceCount = HEALTH_DICE_COUNT_BY_BODY[body] || HEALTH_DICE_COUNT_BY_BODY[1];
  const averageHealth = Math.round(hpDiceCount * dieAverage(hpDieSize));
  const maxHealth = entityType === 'npc' && rolledHealth != null ? rolledHealth : averageHealth;
  return {
    maxHealth,
    activeDefense: Math.round(10 + dieAverage(dexDie)),
    initiative: Math.round(dieAverage(dexDie)),
  };
}

module.exports = { ATTRIBUTE_DIE_SIZE, HEALTH_DIE_SIZE, HEALTH_DICE_COUNT_BY_BODY, deriveCombatStats };
