const pool = require('../config/db');

const SORT_MAP = {
  name:        's.name ASC',
  action_time: 's.action_time ASC, s.name ASC',
  energy_cost: 's.energy_cost ASC, s.name ASC',
};

const SpellModel = {
  async findAll(userId, { magicType, spellKind, ritual, search, sort } = {}) {
    const params = [userId];
    const conditions = ['(s.user_id = $1 OR s.is_public = true)'];

    if (magicType) {
      params.push(magicType);
      conditions.push(`s.magic_type = $${params.length}`);
    }
    if (spellKind) {
      params.push(spellKind);
      conditions.push(`s.spell_kind = $${params.length}`);
    }
    if (ritual) {
      params.push(ritual);
      conditions.push(`s.ritual = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.name ILIKE $${params.length}`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $1) AS is_owner
       FROM spellbook.spells s
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $2) AS is_owner
       FROM spellbook.spells s
       WHERE s.id = $1 AND (s.user_id = $2 OR s.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, magic_type, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO spellbook.spells
         (user_id, name, magic_type, spell_kind, mechanical_desc, narrative_desc,
          energy_cost, action_time, ritual, duration_value, duration_unit,
          range_desc, components, is_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        userId, name, magic_type, spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost ?? 0, action_time ?? 1, ritual ?? 'impossible',
        duration_value ?? null, duration_unit ?? 'instant',
        range_desc ?? null, components ?? [], is_public ?? false,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data) {
    const {
      name, magic_type, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
    } = data;

    const { rows } = await pool.query(
      `UPDATE spellbook.spells
       SET name=$3, magic_type=$4, spell_kind=$5,
           mechanical_desc=$6, narrative_desc=$7,
           energy_cost=$8, action_time=$9, ritual=$10,
           duration_value=$11, duration_unit=$12, range_desc=$13,
           components=$14, is_public=$15, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [
        id, userId, name, magic_type, spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost, action_time, ritual,
        duration_value ?? null, duration_unit, range_desc ?? null,
        components ?? [], is_public ?? false,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM spellbook.spells WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = SpellModel;
