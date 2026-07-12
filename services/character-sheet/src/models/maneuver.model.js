const pool = require('../config/db');

const ManeuverModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.maneuvers WHERE character_id = $1`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, maneuverId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.maneuvers (character_id, maneuver_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, maneuver_id) DO NOTHING
       RETURNING *`,
      [characterId, maneuverId]
    );
    return rows[0] || null;
  },

  async remove(characterId, maneuverId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.maneuvers WHERE character_id = $1 AND maneuver_id = $2`,
      [characterId, maneuverId]
    );
    return rowCount > 0;
  },
};

module.exports = ManeuverModel;
