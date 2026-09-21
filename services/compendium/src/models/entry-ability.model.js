const pool = require('../config/db');

// LEFT JOIN cross-schema into abilities.entries — single table, no union needed.
const EntryAbilityModel = {
  async findAllByEntry(entryId) {
    const { rows } = await pool.query(
      `SELECT ca.*,
              CASE WHEN ae.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ae.id, 'name', ae.name, 'is_maneuver', ae.is_maneuver,
                'duration_value', ae.duration_value, 'duration_unit', ae.duration_unit,
                'description', ae.description, 'is_public', ae.is_public
              ) END AS ability
       FROM compendium.compendium_abilities ca
       LEFT JOIN abilities.entries ae ON ae.id = ca.ability_id
       WHERE ca.entry_id = $1
       ORDER BY ca.created_at ASC`,
      [entryId]
    );
    return rows;
  },

  async add(entryId, abilityId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.compendium_abilities (entry_id, ability_id)
       VALUES ($1, $2)
       ON CONFLICT (entry_id, ability_id) DO NOTHING
       RETURNING *`,
      [entryId, abilityId]
    );
    return rows[0] || null;
  },

  async remove(entryId, abilityId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.compendium_abilities WHERE entry_id = $1 AND ability_id = $2`,
      [entryId, abilityId]
    );
    return rowCount > 0;
  },
};

module.exports = EntryAbilityModel;
