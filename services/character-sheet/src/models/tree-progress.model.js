const pool = require('../config/db');
const { formKeys, progressForKeys } = require('./form-progress');

// form_tier rank for the ON CONFLICT merge below — NULL on an existing row
// of a tiered entry reads as the main ('full') form, same as on the sheet.
const higherTierSql = (table) => `CASE
    WHEN EXCLUDED.form_tier IS NULL THEN ${table}.form_tier
    WHEN array_position(ARRAY['primitive','full','perfected'], EXCLUDED.form_tier)
       > array_position(ARRAY['primitive','full','perfected'], COALESCE(${table}.form_tier, 'full'))
      THEN EXCLUDED.form_tier
    ELSE COALESCE(${table}.form_tier, 'full')
  END`;

// Union keeping the existing order, new keys appended.
const mergeFormsSql = (table) =>
  `${table}.mastered_forms || ARRAY(SELECT unnest(EXCLUDED.mastered_forms) EXCEPT SELECT unnest(${table}.mastered_forms))`;

// Expand a node's grant links (mode='grant') into concrete abilities and
// insert them into the character's sheet. Collections are resolved to their
// members (every form). Spells are never granted by nodes — a node opens
// spell traditions / complexity instead (spell-access.model.js). A link's form_key (null = every form) decides which
// forms the character gets — see progressForKeys; an entry already on the
// sheet keeps its own choices and only gains the new forms (higher tier,
// more mastered forms). Runs on the caller's open transaction client.
// Visibility and the entries' own prerequisites are intentionally NOT
// checked — the GM wired the link on purpose.
async function applyGrants(client, characterId, nodeId) {
  const { rows: grants } = await client.query(
    `SELECT item_kind, item_id, form_key FROM skill_tree.node_grants
     WHERE node_id = $1 AND mode = 'grant'`,
    [nodeId]
  );

  // ability id -> null (every form) | Set of form keys
  const wanted = new Map();
  const want = (id, formKey) => {
    if (wanted.has(id) && wanted.get(id) === null) return;
    if (formKey == null) { wanted.set(id, null); return; }
    wanted.set(id, (wanted.get(id) || new Set()).add(formKey));
  };

  for (const g of grants) {
    if (g.item_kind === 'ability') want(g.item_id, g.form_key);
    else if (g.item_kind === 'ability_collection') {
      const { rows } = await client.query(
        `SELECT item_id, item_kind FROM abilities.collection_items WHERE collection_id = $1`,
        [g.item_id]
      );
      for (const it of rows) want(it.item_id, null);
    }
  }

  const granted = { abilities: [], spells: [] };

  for (const [id, keys] of wanted) {
    const fk = (await formKeys('abilities.entries', id, client)) ?? { tierKinds: [], altIds: [] };
    const p = progressForKeys(keys ? [...keys] : null, fk);
    const { rows } = await client.query(
      `INSERT INTO character_sheet.abilities AS abilities (character_id, ability_id, form_tier, primary_form, mastered_forms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (character_id, ability_id) DO UPDATE
         SET form_tier = ${higherTierSql('abilities')},
             mastered_forms = ${mergeFormsSql('abilities')}
       RETURNING *`,
      [characterId, id, p.form_tier, p.primary_form, p.mastered_forms]
    );
    if (rows[0]) granted.abilities.push(rows[0]);
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

  // Prerequisite + affordability check. experience_points is a plain
  // balance that only the tree spends. Points are charged when the node has
  // no narrative alternative (or require_both is set), or when the player
  // picked the points route (`via` !== 'narrative') — a narrative unlock
  // never spends experience. Returns { ok, spend } on success.
  async canUnlock(characterId, nodeId, via) {
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
    const pointsMandatory = !hasNarrative || node.require_both;
    const spend = node.cost > 0 && (pointsMandatory || via !== 'narrative') ? node.cost : 0;
    if (spend > 0) {
      const { rows: [char] } = await pool.query(
        `SELECT experience_points FROM character_sheet.characters WHERE id = $1`,
        [characterId]
      );
      if (!char || spend > char.experience_points) {
        return { ok: false, status: 403, message: 'Недостатньо пунктів досвіду' };
      }
    }
    return { ok: true, spend };
  },

  // Unlock a node, charge `spend` experience and apply any grant-mode links,
  // atomically. Returns { progress, granted } — progress is null when it was
  // already unlocked (nothing charged), and `insufficient` is set when the
  // balance dropped below `spend` since canUnlock (nothing changed).
  async unlock(characterId, nodeId, spend = 0) {
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
      if (progress && spend > 0) {
        const { rowCount } = await client.query(
          `UPDATE character_sheet.characters
              SET experience_points = experience_points - $2, updated_at = NOW()
            WHERE id = $1 AND experience_points >= $2`,
          [characterId, spend]
        );
        if (rowCount === 0) {
          await client.query('ROLLBACK');
          return { progress: null, granted: { abilities: [], spells: [] }, insufficient: true };
        }
      }
      const granted = progress
        ? await applyGrants(client, characterId, nodeId)
        : { abilities: [], spells: [] };
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
