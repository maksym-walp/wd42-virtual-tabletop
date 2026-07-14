const pool = require('../config/db');

const prereqNodesSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(ae.prerequisite_node_ids)),
    '[]'::jsonb
  )`;

const AbilityModel = {
  // LEFT JOIN cross-schema into abilities.entries — see equipment.model.js for rationale.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ca.*,
              CASE WHEN ae.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ae.id, 'name', ae.name, 'description', ae.description,
                'archetypes', ae.archetypes, 'is_public', ae.is_public,
                'prerequisite_node_ids', ae.prerequisite_node_ids,
                'prerequisite_logic', ae.prerequisite_logic,
                'prerequisite_nodes', ${prereqNodesSelect}
              ) END AS ability
       FROM character_sheet.abilities ca
       LEFT JOIN abilities.entries ae ON ae.id = ca.ability_id
       WHERE ca.character_id = $1`,
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
