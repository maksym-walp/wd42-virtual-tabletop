const pool = require('../config/db');

// A node_grant links a tree node to an ability or a whole ability
// collection. Spells are not linked to nodes — nodes open spell traditions
// and complexity instead (see spell-access.js). `mode`:
//   'unlock' — opening the node makes the entry available to add to a sheet
//   'grant'  — opening the node adds the entry to the sheet outright
// item_id is a bare cross-service UUID (abilities.*), no FK —
// same convention as nodes.effect / entries.prerequisite_node_ids.
// `form_key` (abilities only): null — every form of the entry; else
// the key of one form ('main', 'primitive', 'perfected' or an alternative
// form's id). Not validated against the entry here (cross-service) — a key
// that no longer exists falls back to the main form when applied.
const VALID_KINDS = ['ability', 'ability_collection'];
const FORM_KINDS = ['ability'];
const VALID_MODES = ['grant', 'unlock'];

const formKeyOf = (g) => (FORM_KINDS.includes(g.item_kind) && typeof g.form_key === 'string' && g.form_key.trim()
  ? g.form_key.trim()
  : null);

function sanitize(grants) {
  return (Array.isArray(grants) ? grants : [])
    .filter((g) => g && VALID_KINDS.includes(g.item_kind) && g.item_id
      && VALID_MODES.includes(g.mode ?? 'unlock'))
    // dedupe on (item_kind, item_id) — the table's UNIQUE is (node_id, item_kind, item_id)
    .filter((g, i, arr) => arr.findIndex((o) => o.item_kind === g.item_kind && o.item_id === g.item_id) === i)
    .map((g) => ({ ...g, form_key: formKeyOf(g) }));
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
        `INSERT INTO skill_tree.node_grants (node_id, item_kind, item_id, mode, form_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [nodeId, g.item_kind, g.item_id, g.mode ?? 'unlock', g.form_key]
      );
    }
  },

  // Insert grants for an imported node (already-open transaction). Tolerates
  // dupes so a re-import doesn't blow up.
  async insertMany(client, nodeId, grants) {
    for (const g of sanitize(grants)) {
      await client.query(
        `INSERT INTO skill_tree.node_grants (node_id, item_kind, item_id, mode, form_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (node_id, item_kind, item_id) DO NOTHING`,
        [nodeId, g.item_kind, g.item_id, g.mode ?? 'unlock', g.form_key]
      );
    }
  },
};

module.exports = NodeGrantModel;
