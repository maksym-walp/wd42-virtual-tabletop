const pool = require('../config/db');

const NodeModel = {
  async findAll({ archetype } = {}) {
    const conditions = [];
    const params = [];

    if (archetype) {
      params.push(archetype);
      conditions.push(`archetype = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM skill_tree.nodes ${where} ORDER BY created_at ASC`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM skill_tree.nodes WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, races, archetype, require_both, is_root, replaces_node_id }) {
    const { rows } = await pool.query(
      `INSERT INTO skill_tree.nodes
         (title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, races, archetype, require_both, is_root, replaces_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title, description ?? null, icon ?? null, cost ?? 0, pos_x ?? 0, pos_y ?? 0,
        narrative_condition ?? [], effect ?? [], races ?? [],
        archetype ?? '', require_both ?? false, is_root ?? false, replaces_node_id ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, { title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, races, archetype, require_both, is_root, replaces_node_id }) {
    const { rows } = await pool.query(
      `UPDATE skill_tree.nodes
       SET title=$2, description=$3, icon=$4, cost=$5, pos_x=$6, pos_y=$7,
           narrative_condition=$8, effect=$9, races=$10, archetype=$11,
           require_both=$12, is_root=$13, replaces_node_id=$14, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [
        id, title, description ?? null, icon ?? null, cost ?? 0, pos_x ?? 0, pos_y ?? 0,
        narrative_condition ?? [], effect ?? [], races ?? [],
        archetype ?? '', require_both ?? false, is_root ?? false, replaces_node_id ?? null,
      ]
    );
    return rows[0] || null;
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
