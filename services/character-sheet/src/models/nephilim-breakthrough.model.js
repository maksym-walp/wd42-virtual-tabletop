const pool = require('../config/db');

const NephilimBreakthroughModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT node_id FROM character_sheet.nephilim_breakthroughs
       WHERE character_id = $1
       ORDER BY used_at ASC`,
      [characterId]
    );
    return rows.map(r => r.node_id);
  },

  async use(characterId, nodeId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.nephilim_breakthroughs (character_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, node_id) DO NOTHING
       RETURNING node_id`,
      [characterId, nodeId]
    );
    return rows[0]?.node_id ?? null;
  },

  async revoke(characterId, nodeId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.nephilim_breakthroughs
       WHERE character_id = $1 AND node_id = $2`,
      [characterId, nodeId]
    );
    return rowCount > 0;
  },

  async countUnlocked(characterId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM character_sheet.tree_progress WHERE character_id = $1`,
      [characterId]
    );
    return parseInt(rows[0].cnt, 10);
  },
};

module.exports = NephilimBreakthroughModel;
