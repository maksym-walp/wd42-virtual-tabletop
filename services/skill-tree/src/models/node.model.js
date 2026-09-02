const pool = require('../config/db');
const NodeGrantModel = require('./node-grant.model');

// Every node carries its linked catalog entries / collections (see
// node-grant.model.js) as a `grants` array, aggregated in one shot so the
// editor and the character sheet don't need an N+1 fetch.
const GRANTS_AGG = `COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'item_kind', g.item_kind, 'item_id', g.item_id, 'mode', g.mode
           ) ORDER BY g.created_at ASC)
    FROM skill_tree.node_grants g WHERE g.node_id = n.id
  ), '[]'::jsonb) AS grants`;

const NodeModel = {
  async findAll({ archetype } = {}) {
    const conditions = [];
    const params = [];

    if (archetype) {
      params.push(archetype);
      conditions.push(`n.archetype = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT n.*, ${GRANTS_AGG} FROM skill_tree.nodes n ${where} ORDER BY n.created_at ASC`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT n.*, ${GRANTS_AGG} FROM skill_tree.nodes n WHERE n.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, archetype, require_both, is_root, grants }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO skill_tree.nodes
           (title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, archetype, require_both, is_root)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          title, description ?? null, icon ?? null, cost ?? 0, pos_x ?? 0, pos_y ?? 0,
          narrative_condition ?? [], effect ?? [],
          archetype ?? '', require_both ?? false, is_root ?? false,
        ]
      );
      await NodeGrantModel.replaceForNode(client, rows[0].id, grants);
      await client.query('COMMIT');
      return this.findById(rows[0].id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, { title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, archetype, require_both, is_root, grants }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE skill_tree.nodes
         SET title=$2, description=$3, icon=$4, cost=$5, pos_x=$6, pos_y=$7,
             narrative_condition=$8, effect=$9, archetype=$10,
             require_both=$11, is_root=$12, updated_at=NOW()
         WHERE id=$1
         RETURNING id`,
        [
          id, title, description ?? null, icon ?? null, cost ?? 0, pos_x ?? 0, pos_y ?? 0,
          narrative_condition ?? [], effect ?? [],
          archetype ?? '', require_both ?? false, is_root ?? false,
        ]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      // Only touch grants when the caller sent the key — a plain field edit
      // (e.g. drag-reorder PATCH) omits it and must leave links intact.
      if (grants !== undefined) {
        await NodeGrantModel.replaceForNode(client, id, grants);
      }
      await client.query('COMMIT');
      return this.findById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM skill_tree.nodes WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  },
};

module.exports = NodeModel;
