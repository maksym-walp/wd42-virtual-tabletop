const pool = require('../config/db');

const EdgeModel = {
  async findAll({ archetype } = {}) {
    if (archetype) {
      const { rows } = await pool.query(
        `SELECT e.* FROM skill_tree.edges e
         JOIN skill_tree.nodes n ON n.id = e.source_id
         WHERE n.archetype = $1
         ORDER BY e.created_at ASC`,
        [archetype]
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT * FROM skill_tree.edges ORDER BY created_at ASC`
    );
    return rows;
  },

  async create({ source_id, target_id, edge_type }) {
    const { rows } = await pool.query(
      `INSERT INTO skill_tree.edges (source_id, target_id, edge_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [source_id, target_id, edge_type ?? 'required']
    );
    return rows[0];
  },

  async updateType(id, edge_type) {
    const { rows } = await pool.query(
      `UPDATE skill_tree.edges SET edge_type = $2 WHERE id = $1 RETURNING *`,
      [id, edge_type]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM skill_tree.edges WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  },
};

module.exports = EdgeModel;
