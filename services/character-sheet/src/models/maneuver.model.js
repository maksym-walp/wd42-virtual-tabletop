const pool = require('../config/db');

const prereqNodesSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(me.prerequisite_node_ids)),
    '[]'::jsonb
  )`;

const ManeuverModel = {
  // LEFT JOIN cross-schema into maneuvers.entries — see equipment.model.js for rationale.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT cm.*,
              CASE WHEN me.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', me.id, 'name', me.name, 'duration_actions', me.duration_actions,
                'description', me.description, 'is_public', me.is_public,
                'prerequisite_node_ids', me.prerequisite_node_ids,
                'prerequisite_logic', me.prerequisite_logic,
                'prerequisite_nodes', ${prereqNodesSelect}
              ) END AS maneuver
       FROM character_sheet.maneuvers cm
       LEFT JOIN maneuvers.entries me ON me.id = cm.maneuver_id
       WHERE cm.character_id = $1`,
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
