const pool = require('../config/db');

// A node_grant links a tree node to a catalog entry (ability / maneuver /
// spell) or a whole collection (ability or spell collection). `mode`:
//   'unlock' — opening the node makes the entry available to add to a sheet
//   'grant'  — opening the node adds the entry to the sheet outright
// item_id is a bare cross-service UUID (abilities.* / spellbook.*), no FK —
// same convention as nodes.effect / entries.prerequisite_node_ids.
const VALID_KINDS = ['ability', 'maneuver', 'spell', 'ability_collection', 'spell_collection'];
const VALID_MODES = ['grant', 'unlock'];

function sanitize(grants) {
  return (Array.isArray(grants) ? grants : [])
    .filter((g) => g && VALID_KINDS.includes(g.item_kind) && g.item_id
      && VALID_MODES.includes(g.mode ?? 'unlock'))
    // dedupe on (item_kind, item_id) — the table's UNIQUE is (node_id, item_kind, item_id)
    .filter((g, i, arr) => arr.findIndex((o) => o.item_kind === g.item_kind && o.item_id === g.item_id) === i);
}

const NodeGrantModel = {
  async findForNode(nodeId) {
    const { rows } = await pool.query(
      `SELECT * FROM skill_tree.node_grants WHERE node_id = $1 ORDER BY created_at ASC`,
      [nodeId]
    );
    return rows;
  },

  // Replace the entire grant list for one node. Runs on the caller-supplied
  // client so it shares the node create/update transaction.
  async replaceForNode(client, nodeId, grants) {
    await client.query('DELETE FROM skill_tree.node_grants WHERE node_id = $1', [nodeId]);
    for (const g of sanitize(grants)) {
      await client.query(
        `INSERT INTO skill_tree.node_grants (node_id, item_kind, item_id, mode)
         VALUES ($1, $2, $3, $4)`,
        [nodeId, g.item_kind, g.item_id, g.mode ?? 'unlock']
      );
    }
  },

  // Insert grants for an imported node (already-open transaction). Tolerates
  // dupes so a re-import doesn't blow up.
  async insertMany(client, nodeId, grants) {
    for (const g of sanitize(grants)) {
      await client.query(
        `INSERT INTO skill_tree.node_grants (node_id, item_kind, item_id, mode)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (node_id, item_kind, item_id) DO NOTHING`,
        [nodeId, g.item_kind, g.item_id, g.mode ?? 'unlock']
      );
    }
  },
};

module.exports = NodeGrantModel;
