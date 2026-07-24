const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');

const spellsSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
     FROM spellbook.tradition_spells ts
     JOIN spellbook.spells s ON s.id = ts.spell_id
     WHERE ts.tradition_id = t.id),
    '[]'::jsonb
  ) AS spells`;

const TraditionModel = {
  async findAll({ search } = {}) {
    const params = [];
    const conditions = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`t.name ILIKE $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT t.*, ${spellsSelect}
       FROM spellbook.traditions t
       ${where}
       ORDER BY t.name ASC`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT t.*, ${spellsSelect}
       FROM spellbook.traditions t
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, founders } = data;
    const { rows } = await pool.query(
      `INSERT INTO spellbook.traditions (name, description, founders, creator_id)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name, description ?? null, founders ?? null, userId]
    );
    return rows[0];
  },

  // No ownership check — write access is gated at the route level
  // (requireCanonicalManager), since traditions have no owner.
  async update(id, data) {
    const { name, description, founders } = data;
    const { rows } = await pool.query(
      `UPDATE spellbook.traditions
       SET name=$2, description=$3, founders=$4, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id, name, description ?? null, founders ?? null]
    );
    return rows[0] || null;
  },

  async delete(id, deletedBy = null) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'spellbook',
      tableName: 'traditions',
      deleteQuery: `DELETE FROM spellbook.traditions WHERE id = $1 RETURNING *`,
      deleteParams: [id],
      childQueries: [
        { key: 'tradition_spells', sql: `SELECT * FROM spellbook.tradition_spells WHERE tradition_id = $1`, params: [id] },
      ],
      deletedBy,
    });
    return !!record;
  },

  // Ownership is checked against the SPELL (traditions have no owner) —
  // attaching an existing tradition to your own spell is part of editing
  // that spell, not managing the tradition itself.
  async addSpell(traditionId, userId, spellId, isAdmin = false) {
    const owns = await pool.query(
      `SELECT 1 FROM spellbook.spells WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [spellId, userId, isAdmin]
    );
    if (!owns.rows.length) return null;

    const { rows } = await pool.query(
      `INSERT INTO spellbook.tradition_spells (tradition_id, spell_id)
       VALUES ($1, $2)
       ON CONFLICT (tradition_id, spell_id) DO NOTHING
       RETURNING *`,
      [traditionId, spellId]
    );
    return rows[0] || { tradition_id: traditionId, spell_id: spellId };
  },

  async removeSpell(traditionId, userId, spellId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM spellbook.tradition_spells ts
       USING spellbook.spells s
       WHERE ts.spell_id = s.id AND s.id = $3 AND (s.user_id = $2 OR $4 = true) AND ts.tradition_id = $1`,
      [traditionId, userId, spellId, isAdmin]
    );
    return rowCount > 0;
  },
};

module.exports = TraditionModel;
