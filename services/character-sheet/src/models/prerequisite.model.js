const pool = require('../config/db');

// sourceTable is always a fixed literal from our own code
// ('abilities.entries' | 'abilities.maneuvers' | 'spellbook.spells'), never user input.
const KIND_BY_TABLE = {
  'abilities.entries': 'ability',
  'abilities.maneuvers': 'maneuver',
  'spellbook.spells': 'spell',
};

// A catalog entry can be gated onto skill-tree nodes two ways, OR'd together:
//   1. its own prerequisite_node_ids / prerequisite_logic column
//   2. a skill_tree.node_grants row pointing at it (directly, or at a
//      collection it belongs to) — the node editor's "робить доступним" / "видає"
// If neither gate exists, the entry is freely addable (unchanged behaviour).
async function checkPrerequisites(characterId, sourceTable, itemId) {
  const itemKind = KIND_BY_TABLE[sourceTable];

  const { rows } = await pool.query(
    `SELECT prerequisite_node_ids, prerequisite_logic FROM ${sourceTable} WHERE id = $1`,
    [itemId]
  );
  const item = rows[0];
  if (!item) return { met: true, missing: [] };

  const prereqIds = item.prerequisite_node_ids || [];

  const collectionItemsTable = itemKind === 'spell' ? 'spellbook.collection_items' : 'abilities.collection_items';
  const collectionItemCol = itemKind === 'spell' ? 'spell_id' : 'item_id';
  const collectionGrantKind = itemKind === 'spell' ? 'spell_collection' : 'ability_collection';

  const { rows: gateRows } = await pool.query(
    `SELECT DISTINCT g.node_id
       FROM skill_tree.node_grants g
      WHERE (g.item_kind = $2 AND g.item_id = $1)
         OR (g.item_kind = $3 AND g.item_id IN (
              SELECT collection_id FROM ${collectionItemsTable} WHERE ${collectionItemCol} = $1
            ))`,
    [itemId, itemKind, collectionGrantKind]
  );
  const gateNodeIds = gateRows.map((r) => r.node_id);

  if (prereqIds.length === 0 && gateNodeIds.length === 0) return { met: true, missing: [] };

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
  return { met, missing };
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
