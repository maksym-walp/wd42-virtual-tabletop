const pool = require('../config/db');

const prereqNodesSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(sp.prerequisite_node_ids)),
    '[]'::jsonb
  )`;

const SpellProgressModel = {
  // LEFT JOIN cross-schema into spellbook.spells — see equipment.model.js for rationale.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ks.*,
              CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', sp.id, 'name', sp.name, 'nature', sp.nature,
                'spell_kind', sp.spell_kind, 'complexity', sp.complexity, 'forms', sp.forms, 'main_form_name', sp.main_form_name,
                'mechanical_desc', sp.mechanical_desc, 'narrative_desc', sp.narrative_desc,
                'energy_cost', sp.energy_cost, 'action_time', sp.action_time, 'ritual', sp.ritual,
                'duration_value', sp.duration_value, 'duration_unit', sp.duration_unit,
                'range_desc', sp.range_desc, 'components', sp.components, 'is_public', sp.is_public,
                'prerequisite_node_ids', sp.prerequisite_node_ids,
                'prerequisite_logic', sp.prerequisite_logic,
                'prerequisite_nodes', ${prereqNodesSelect}
              ) END AS spell
       FROM character_sheet.known_spells ks
       LEFT JOIN spellbook.spells sp ON sp.id = ks.spell_id
       WHERE ks.character_id = $1
       ORDER BY ks.mastered ASC, ks.cast_count DESC`,
      [characterId]
    );
    return rows;
  },

  // Які форми має заклинання (spellbook.spells.forms) — для перевірки
  // form_tier/primary_form/mastered_forms: tierKinds — наявні додаткові
  // рівневі форми ('primitive'/'perfected'), altIds — id альтернативних.
  // null, якщо заклинання не існує.
  async formKeys(spellId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(array_agg(f->>'kind') FILTER (WHERE f->>'kind' IN ('primitive', 'perfected')), '{}') AS tier_kinds,
              COALESCE(array_agg(f->>'id') FILTER (WHERE f->>'kind' = 'alternative'), '{}') AS alt_ids
       FROM spellbook.spells s
       LEFT JOIN LATERAL jsonb_array_elements(s.forms) f ON true
       WHERE s.id = $1
       GROUP BY s.id`,
      [spellId]
    );
    if (!rows[0]) return null;
    return { tierKinds: rows[0].tier_kinds, altIds: rows[0].alt_ids };
  },

  async add(characterId, spellId, { form_tier = null, primary_form = 'main', mastered_forms = ['main'] } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.known_spells (character_id, spell_id, form_tier, primary_form, mastered_forms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (character_id, spell_id) DO NOTHING
       RETURNING *`,
      [characterId, spellId, form_tier, primary_form, mastered_forms]
    );
    return rows[0] || null;
  },

  async patch(characterId, spellId, { mastered, cast_count, form_tier, primary_form, mastered_forms }) {
    // Auto-master after 3 casts
    const effectiveMastered = mastered ?? (cast_count >= 3 ? true : undefined);

    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE character_sheet.known_spells
         SET mastered   = COALESCE($3, mastered),
             cast_count = COALESCE($4, cast_count),
             form_tier      = COALESCE($5, form_tier),
             primary_form   = COALESCE($6, primary_form),
             mastered_forms = COALESCE($7, mastered_forms)
         WHERE character_id = $1 AND spell_id = $2
         RETURNING *
       )
       SELECT ks.*,
              CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', sp.id, 'name', sp.name, 'nature', sp.nature,
                'spell_kind', sp.spell_kind, 'complexity', sp.complexity, 'forms', sp.forms, 'main_form_name', sp.main_form_name,
                'mechanical_desc', sp.mechanical_desc, 'narrative_desc', sp.narrative_desc,
                'energy_cost', sp.energy_cost, 'action_time', sp.action_time, 'ritual', sp.ritual,
                'duration_value', sp.duration_value, 'duration_unit', sp.duration_unit,
                'range_desc', sp.range_desc, 'components', sp.components, 'is_public', sp.is_public,
                'prerequisite_node_ids', sp.prerequisite_node_ids,
                'prerequisite_logic', sp.prerequisite_logic,
                'prerequisite_nodes', ${prereqNodesSelect}
              ) END AS spell
       FROM updated ks
       LEFT JOIN spellbook.spells sp ON sp.id = ks.spell_id`,
      [characterId, spellId, effectiveMastered ?? null, cast_count ?? null,
       form_tier ?? null, primary_form ?? null, mastered_forms ?? null]
    );
    return rows[0] || null;
  },

  async remove(characterId, spellId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.known_spells
       WHERE character_id = $1 AND spell_id = $2`,
      [characterId, spellId]
    );
    return rowCount > 0;
  },
};

module.exports = SpellProgressModel;
