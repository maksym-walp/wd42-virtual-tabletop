const pool = require('../config/db');
const CharacterModel = require('./character.model');

// Expand a node's grant links (mode='grant') into concrete catalog ids and
// insert them into the character's sheet. Collections are resolved to their
// members. Runs on the caller's open transaction client. Visibility and the
// entries' own prerequisites are intentionally NOT checked — the GM wired
// the link on purpose.
async function applyGrants(client, characterId, nodeId) {
  const { rows: grants } = await client.query(
    `SELECT item_kind, item_id FROM skill_tree.node_grants
     WHERE node_id = $1 AND mode = 'grant'`,
    [nodeId]
  );

  const abilityIds = new Set();
  const maneuverIds = new Set();
  const spellIds = new Set();

  for (const g of grants) {
    if (g.item_kind === 'ability') abilityIds.add(g.item_id);
    else if (g.item_kind === 'maneuver') maneuverIds.add(g.item_id);
    else if (g.item_kind === 'spell') spellIds.add(g.item_id);
    else if (g.item_kind === 'ability_collection') {
      const { rows } = await client.query(
        `SELECT item_id, item_kind FROM abilities.collection_items WHERE collection_id = $1`,
        [g.item_id]
      );
      for (const it of rows) {
        if (it.item_kind === 'maneuver') maneuverIds.add(it.item_id);
        else abilityIds.add(it.item_id);
      }
    } else if (g.item_kind === 'spell_collection') {
      const { rows } = await client.query(
        `SELECT spell_id FROM spellbook.collection_items WHERE collection_id = $1`,
        [g.item_id]
      );
      for (const it of rows) spellIds.add(it.spell_id);
    }
  }

  const granted = { abilities: [], maneuvers: [], spells: [] };

  for (const id of abilityIds) {
    const { rows } = await client.query(
      `INSERT INTO character_sheet.abilities (character_id, ability_id) VALUES ($1, $2)
       ON CONFLICT (character_id, ability_id) DO NOTHING RETURNING *`,
      [characterId, id]
    );
    if (rows[0]) granted.abilities.push(rows[0]);
  }
  for (const id of maneuverIds) {
    const { rows } = await client.query(
      `INSERT INTO character_sheet.maneuvers (character_id, maneuver_id) VALUES ($1, $2)
       ON CONFLICT (character_id, maneuver_id) DO NOTHING RETURNING *`,
      [characterId, id]
    );
    if (rows[0]) granted.maneuvers.push(rows[0]);
  }
  for (const id of spellIds) {
    const { rows } = await client.query(
      `INSERT INTO character_sheet.known_spells (character_id, spell_id) VALUES ($1, $2)
       ON CONFLICT (character_id, spell_id) DO NOTHING RETURNING *`,
      [characterId, id]
    );
    if (rows[0]) granted.spells.push(rows[0]);
  }

  return granted;
}

const TreeProgressModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.tree_progress
       WHERE character_id = $1
       ORDER BY unlocked_at ASC`,
      [characterId]
    );
    return rows;
  },

  // Prerequisite + affordability check. Points are only mandatory when the
  // node has no narrative alternative (or require_both is set) — a purely
  // narrative unlock never spends experience.
  async canUnlock(characterId, nodeId) {
    const { rows: [node] } = await pool.query(
      `SELECT id, cost, require_both, narrative_condition FROM skill_tree.nodes WHERE id = $1`,
      [nodeId]
    );
    if (!node) return { ok: false, status: 404, message: 'Вузол не знайдено' };

    const { rows: incoming } = await pool.query(
      `SELECT source_id, edge_type FROM skill_tree.edges WHERE target_id = $1`,
      [nodeId]
    );
    const { rows: unlocked } = await pool.query(
      `SELECT node_id FROM character_sheet.tree_progress WHERE character_id = $1`,
      [characterId]
    );
    const unlockedSet = new Set(unlocked.map((r) => r.node_id));
    const required = incoming.filter((e) => e.edge_type !== 'optional');
    const optional = incoming.filter((e) => e.edge_type === 'optional');
    const prereqsMet = required.every((e) => unlockedSet.has(e.source_id))
      && (optional.length === 0 || optional.some((e) => unlockedSet.has(e.source_id)));
    if (!prereqsMet) {
      return { ok: false, status: 403, message: 'Вимоги дерева розвитку не виконані' };
    }

    const hasNarrative = (node.narrative_condition || []).length > 0;
    const pointsMandatory = node.cost > 0 && (!hasNarrative || node.require_both);
    if (pointsMandatory) {
      const summary = await CharacterModel.experienceSummary(characterId);
      if (summary && node.cost > summary.remaining) {
        return { ok: false, status: 403, message: 'Недостатньо пунктів досвіду' };
      }
    }
    return { ok: true };
  },

  // Unlock a node and apply any grant-mode links, atomically. Returns
  // { progress, granted } — progress is null when it was already unlocked.
  async unlock(characterId, nodeId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO character_sheet.tree_progress (character_id, node_id)
         VALUES ($1, $2)
         ON CONFLICT (character_id, node_id) DO NOTHING
         RETURNING *`,
        [characterId, nodeId]
      );
      const progress = rows[0] || null;
      const granted = progress
        ? await applyGrants(client, characterId, nodeId)
        : { abilities: [], maneuvers: [], spells: [] };
      await client.query('COMMIT');
      return { progress, granted };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async lock(characterId, nodeId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.tree_progress
       WHERE character_id = $1 AND node_id = $2`,
      [characterId, nodeId]
    );
    return rowCount > 0;
  },
};

module.exports = TreeProgressModel;
