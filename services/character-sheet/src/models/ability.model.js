const pool = require('../config/db');
const { formKeys } = require('./form-progress');

const prereqNodesSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(ae.prerequisite_node_ids)),
    '[]'::jsonb
  )`;

const abilitySelect = `CASE WHEN ae.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', ae.id, 'name', ae.name, 'mechanical_desc', ae.mechanical_desc, 'narrative_desc', ae.narrative_desc,
    'archetypes', ae.archetypes, 'is_public', ae.is_public,
    'prerequisite_node_ids', ae.prerequisite_node_ids,
    'prerequisite_logic', ae.prerequisite_logic,
    'prerequisite_nodes', ${prereqNodesSelect},
    'is_maneuver', ae.is_maneuver,
    'duration_value', ae.duration_value,
    'duration_unit', ae.duration_unit,
    'lore_creator', ae.lore_creator,
    'forms', ae.forms,
    'main_form_name', ae.main_form_name
  ) END AS ability`;

const AbilityModel = {
  // LEFT JOIN cross-schema into abilities.entries — see equipment.model.js for rationale.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ca.*, ${abilitySelect}
       FROM character_sheet.abilities ca
       LEFT JOIN abilities.entries ae ON ae.id = ca.ability_id
       WHERE ca.character_id = $1`,
      [characterId]
    );
    return rows;
  },

  // Які форми має вміння — див. form-progress.js. null, якщо його не існує.
  formKeys(abilityId) {
    return formKeys('abilities.entries', abilityId);
  },

  async findOne(characterId, abilityId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.abilities WHERE character_id = $1 AND ability_id = $2`,
      [characterId, abilityId]
    );
    return rows[0] || null;
  },

  async add(characterId, abilityId, { form_tier = null, primary_form = 'main', mastered_forms = ['main'] } = {}) {
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO character_sheet.abilities (character_id, ability_id, form_tier, primary_form, mastered_forms)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (character_id, ability_id) DO NOTHING
         RETURNING *
       )
       SELECT ca.*, ${abilitySelect}
       FROM inserted ca
       LEFT JOIN abilities.entries ae ON ae.id = ca.ability_id`,
      [characterId, abilityId, form_tier, primary_form, mastered_forms]
    );
    return rows[0] || null;
  },

  async patch(characterId, abilityId, { form_tier, primary_form, mastered_forms }) {
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE character_sheet.abilities
         SET form_tier      = COALESCE($3, form_tier),
             primary_form   = COALESCE($4, primary_form),
             mastered_forms = COALESCE($5, mastered_forms)
         WHERE character_id = $1 AND ability_id = $2
         RETURNING *
       )
       SELECT ca.*, ${abilitySelect}
       FROM updated ca
       LEFT JOIN abilities.entries ae ON ae.id = ca.ability_id`,
      [characterId, abilityId, form_tier ?? null, primary_form ?? null, mastered_forms ?? null]
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
