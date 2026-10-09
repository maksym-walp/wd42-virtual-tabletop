const pool = require('../config/db');

// sourceTable is always a fixed literal from our own code, never user input.
// Only abilities are gated by nodes — spells go through traditions and
// complexity instead (spell-access.model.js).

// A catalog entry can be gated onto skill-tree nodes two ways, OR'd together:
//   1. its own prerequisite_node_ids / prerequisite_logic column
//   2. a skill_tree.node_grants row pointing at it (directly, or at a
//      collection it belongs to) — the node editor's "робить доступним" / "видає"
// If neither gate exists, the entry is freely addable (unchanged behaviour).
//
// Also returns `allowedForms` — which of the entry's forms the character may
// take (see form-progress.js for the keys): null = every form (no gates, the
// entry's own prerequisites met, or an unlocked link for the whole entry /
// a collection holding it); otherwise the union of the form_keys of the
// unlocked node_grants links; [] when not met at all.
async function checkPrerequisites(characterId, sourceTable, itemId) {
  const { rows } = await pool.query(
    `SELECT prerequisite_node_ids, prerequisite_logic FROM ${sourceTable} WHERE id = $1`,
    [itemId]
  );
  const item = rows[0];
  if (!item) return { met: true, missing: [], allowedForms: null };

  const prereqIds = item.prerequisite_node_ids || [];

  const { rows: gateRows } = await pool.query(
    `SELECT DISTINCT g.node_id, CASE WHEN g.item_kind = 'ability' THEN g.form_key END AS form_key
       FROM skill_tree.node_grants g
      WHERE (g.item_kind = 'ability' AND g.item_id = $1)
         OR (g.item_kind = 'ability_collection' AND g.item_id IN (
              SELECT collection_id FROM abilities.collection_items WHERE item_id = $1
            ))`,
    [itemId]
  );
  const gateNodeIds = [...new Set(gateRows.map((r) => r.node_id))];

  if (prereqIds.length === 0 && gateNodeIds.length === 0) return { met: true, missing: [], allowedForms: null };

  const allNodeIds = [...new Set([...prereqIds, ...gateNodeIds])];
  const { rows: unlocked } = await pool.query(
    `SELECT node_id FROM character_sheet.tree_progress WHERE character_id = $1 AND node_id = ANY($2)`,
    [characterId, allNodeIds]
  );
  const unlockedSet = new Set(unlocked.map((r) => r.node_id));

  const prereqOk = prereqIds.length > 0 && (
    item.prerequisite_logic === 'and'
      ? prereqIds.every((id) => unlockedSet.has(id))
      : prereqIds.some((id) => unlockedSet.has(id))
  );
  const gateOk = gateNodeIds.some((id) => unlockedSet.has(id));
  const met = prereqOk || gateOk;

  const missing = met ? [] : allNodeIds.filter((id) => !unlockedSet.has(id));

  const openGates = gateRows.filter((r) => unlockedSet.has(r.node_id));
  let allowedForms = [];
  if (prereqOk || openGates.some((r) => r.form_key == null)) allowedForms = null;
  else allowedForms = [...new Set(openGates.map((r) => r.form_key))];

  return { met, missing, allowedForms };
}

// sourceTable is always a fixed literal from our own code, never user input.
// A catalog entry is visible to a user if they own it or it's marked public —
// mirrors the privacy filter each catalog service applies to its own list/getById.
async function isVisibleToUser(sourceTable, itemId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM ${sourceTable} WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
    [itemId, userId]
  );
  return rows.length > 0;
}

module.exports = { checkPrerequisites, isVisibleToUser };
