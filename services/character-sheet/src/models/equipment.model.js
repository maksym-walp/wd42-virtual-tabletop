const pool = require('../config/db');

const EquipmentModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.equipment
       WHERE character_id = $1
       ORDER BY mastered ASC, mastery_count DESC`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, equipmentId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.equipment (character_id, equipment_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, equipment_id) DO NOTHING
       RETURNING *`,
      [characterId, equipmentId]
    );
    return rows[0] || null;
  },

  async patch(characterId, equipmentId, { mastery_count, mastered }) {
    // Auto-master when mastery_count reaches 3
    const effectiveMastered = mastered ?? (mastery_count >= 3 ? true : undefined);

    const { rows } = await pool.query(
      `UPDATE character_sheet.equipment
       SET mastery_count = COALESCE($3, mastery_count),
           mastered      = COALESCE($4, mastered)
       WHERE character_id = $1 AND equipment_id = $2
       RETURNING *`,
      [characterId, equipmentId, mastery_count ?? null, effectiveMastered ?? null]
    );
    return rows[0] || null;
  },

  async remove(characterId, equipmentId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.equipment WHERE character_id = $1 AND equipment_id = $2`,
      [characterId, equipmentId]
    );
    return rowCount > 0;
  },
};

module.exports = EquipmentModel;
