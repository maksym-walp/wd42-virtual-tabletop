const pool = require('../config/db');
const { entryTiers } = require('./form-progress');

// Традиції заклинання — для перевірки доступності на клієнті (див.
// spell-access.model.js).
const traditionIdsSelect = `COALESCE(
    (SELECT jsonb_agg(ts.tradition_id) FROM spellbook.tradition_spells ts WHERE ts.spell_id = sp.id),
    '[]'::jsonb
  )`;

const SpellProgressModel = {
  // LEFT JOIN cross-schema into spellbook.spells — see equipment.model.js for rationale.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ks.*,
              CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', sp.id, 'name', sp.name, 'nature', sp.nature,
                'spell_kind', sp.spell_kind, 'complexity', sp.complexity, 'forms', sp.forms, 'damage_die', sp.damage_die,
                'damage_dice_count', sp.damage_dice_count,
                'mechanical_desc', sp.mechanical_desc, 'narrative_desc', sp.narrative_desc,
                'energy_cost', sp.energy_cost, 'action_time', sp.action_time, 'ritual', sp.ritual,
                'duration_value', sp.duration_value, 'duration_unit', sp.duration_unit,
                'range_desc', sp.range_desc, 'components', sp.components, 'is_public', sp.is_public,
                'tradition_ids', ${traditionIdsSelect}
              ) END AS spell
       FROM character_sheet.known_spells ks
       LEFT JOIN spellbook.spells sp ON sp.id = ks.spell_id
       WHERE ks.character_id = $1
       ORDER BY ks.mastered ASC, ks.cast_count DESC`,
      [characterId]
    );
    return rows;
  },

  // Рівневі форми заклинання по зростанню — див. form-progress.js. null,
  // якщо його не існує.
  tiers(spellId) {
    return entryTiers('spellbook.spells', spellId);
  },

  // Бойові заклинання (spell_kind='combat') кількох персонажів одразу —
  // battle tracker's GET /effects, той самий пакетний патерн, що й
  // EquipmentModel.weaponsForMany (без цього був би N+1 на комбатанта).
  async combatSpellsForMany(characterIds) {
    if (!characterIds.length) return {};
    const { rows } = await pool.query(
      `SELECT ks.character_id, ks.spell_id, ks.mastered, ks.cast_count, ks.form_tier, ks.gm_granted,
              sp.name, sp.forms, sp.damage_die, sp.damage_dice_count, sp.energy_cost, sp.action_time, sp.complexity,
              ${traditionIdsSelect} AS tradition_ids
       FROM character_sheet.known_spells ks
       JOIN spellbook.spells sp ON sp.id = ks.spell_id
       WHERE ks.character_id = ANY($1::uuid[]) AND sp.spell_kind = 'combat'
       ORDER BY sp.name ASC`,
      [characterIds]
    );
    const byCharacter = {};
    for (const { character_id, ...spell } of rows) {
      (byCharacter[character_id] ||= []).push(spell);
    }
    return byCharacter;
  },

  async findOne(characterId, spellId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.known_spells WHERE character_id = $1 AND spell_id = $2`,
      [characterId, spellId]
    );
    return rows[0] || null;
  },

  // gm_granted — заклинання дав майстер: правила доступності (традиції й
  // складність з дерева) для цього запису не діють.
  async add(characterId, spellId, { form_tier = null, gm_granted = false } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.known_spells (character_id, spell_id, form_tier, gm_granted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (character_id, spell_id) DO NOTHING
       RETURNING *`,
      [characterId, spellId, form_tier, gm_granted]
    );
    return rows[0] || null;
  },

  async patch(characterId, spellId, { mastered, cast_count, form_tier }) {
    // Auto-master after 3 casts
    const effectiveMastered = mastered ?? (cast_count >= 3 ? true : undefined);

    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE character_sheet.known_spells
         SET mastered   = COALESCE($3, mastered),
             cast_count = COALESCE($4, cast_count),
             form_tier  = COALESCE($5, form_tier)
         WHERE character_id = $1 AND spell_id = $2
         RETURNING *
       )
       SELECT ks.*,
              CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', sp.id, 'name', sp.name, 'nature', sp.nature,
                'spell_kind', sp.spell_kind, 'complexity', sp.complexity, 'forms', sp.forms, 'damage_die', sp.damage_die,
                'damage_dice_count', sp.damage_dice_count,
                'mechanical_desc', sp.mechanical_desc, 'narrative_desc', sp.narrative_desc,
                'energy_cost', sp.energy_cost, 'action_time', sp.action_time, 'ritual', sp.ritual,
                'duration_value', sp.duration_value, 'duration_unit', sp.duration_unit,
                'range_desc', sp.range_desc, 'components', sp.components, 'is_public', sp.is_public,
                'tradition_ids', ${traditionIdsSelect}
              ) END AS spell
       FROM updated ks
       LEFT JOIN spellbook.spells sp ON sp.id = ks.spell_id`,
      [characterId, spellId, effectiveMastered ?? null, cast_count ?? null, form_tier ?? null]
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
