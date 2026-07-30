const pool = require('../config/db');

// LEFT JOIN cross-schema into maneuvers.entries — single table, no union needed.
const EntryManeuverModel = {
  async findAllByEntry(entryId) {
    const { rows } = await pool.query(
      `SELECT cm.*,
              CASE WHEN me.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', me.id, 'name', me.name, 'duration_actions', me.duration_actions,
                'description', me.description, 'is_public', me.is_public
              ) END AS maneuver
       FROM compendium.compendium_maneuvers cm
       LEFT JOIN maneuvers.entries me ON me.id = cm.maneuver_id
       WHERE cm.entry_id = $1
       ORDER BY cm.created_at ASC`,
      [entryId]
    );
    return rows;
  },

  async add(entryId, maneuverId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.compendium_maneuvers (entry_id, maneuver_id)
       VALUES ($1, $2)
       ON CONFLICT (entry_id, maneuver_id) DO NOTHING
       RETURNING *`,
      [entryId, maneuverId]
    );
    return rows[0] || null;
  },

  async remove(entryId, maneuverId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.compendium_maneuvers WHERE entry_id = $1 AND maneuver_id = $2`,
      [entryId, maneuverId]
    );
    return rowCount > 0;
  },
};

module.exports = EntryManeuverModel;
