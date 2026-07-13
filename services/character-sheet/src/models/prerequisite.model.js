const pool = require('../config/db');

// sourceTable is always a fixed literal from our own code
// ('abilities.entries' | 'maneuvers.entries' | 'spellbook.spells'), never user input.
async function checkPrerequisites(characterId, sourceTable, itemId) {
  const { rows } = await pool.query(
    `SELECT prerequisite_node_ids, prerequisite_logic FROM ${sourceTable} WHERE id = $1`,
    [itemId]
  );
  const item = rows[0];
  if (!item || !item.prerequisite_node_ids?.length) return { met: true, missing: [] };

  const { rows: unlocked } = await pool.query(
    `SELECT node_id FROM character_sheet.tree_progress WHERE character_id = $1 AND node_id = ANY($2)`,
    [characterId, item.prerequisite_node_ids]
  );
  const unlockedSet = new Set(unlocked.map((r) => r.node_id));
  const missing = item.prerequisite_node_ids.filter((id) => !unlockedSet.has(id));
  const met = item.prerequisite_logic === 'and' ? missing.length === 0 : unlockedSet.size > 0;
  return { met, missing };
}

module.exports = { checkPrerequisites };
