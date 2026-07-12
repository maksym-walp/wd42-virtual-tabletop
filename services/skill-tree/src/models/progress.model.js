const pool = require('../config/db');

const ProgressModel = {
  async findByUser(userId) {
    const { rows } = await pool.query(
      `SELECT node_id, unlocked_at FROM skill_tree.player_progress
       WHERE user_id = $1`,
      [userId]
    );
    return rows;
  },

  async unlock(userId, nodeId) {
    const { rows } = await pool.query(
      `INSERT INTO skill_tree.player_progress (user_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, node_id) DO NOTHING
       RETURNING *`,
      [userId, nodeId]
    );
    return rows[0] || null;
  },

  async lock(userId, nodeId) {
    const { rowCount } = await pool.query(
      `DELETE FROM skill_tree.player_progress
       WHERE user_id = $1 AND node_id = $2`,
      [userId, nodeId]
    );
    return rowCount > 0;
  },

  async findAllUsers() {
    const { rows } = await pool.query(
      `SELECT user_id, node_id, unlocked_at FROM skill_tree.player_progress
       ORDER BY user_id, unlocked_at ASC`
    );
    return rows;
  },
};

module.exports = ProgressModel;
