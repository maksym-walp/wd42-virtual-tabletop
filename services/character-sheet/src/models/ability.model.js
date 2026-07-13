const pool = require('../config/db');

const AbilityModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.abilities WHERE character_id = $1`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, abilityId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.abilities (character_id, ability_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, ability_id) DO NOTHING
       RETURNING *`,
      [characterId, abilityId]
    );
    return rows[0] || null;
  },

  async remove(characterId, abilityId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.abilities WHERE character_id = $1 AND ability_id = $2`,
      [characterId, abilityId]
    );
    return rowCount > 0;
  },
};

module.exports = AbilityModel;
