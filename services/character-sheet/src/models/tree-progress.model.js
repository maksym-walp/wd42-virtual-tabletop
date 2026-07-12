const pool = require('../config/db');

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

  async unlock(characterId, nodeId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.tree_progress (character_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, node_id) DO NOTHING
       RETURNING *`,
      [characterId, nodeId]
    );
    return rows[0] || null;
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
