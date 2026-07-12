const pool = require('../config/db');

const SpellProgressModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.known_spells
       WHERE character_id = $1
       ORDER BY mastered ASC, cast_count DESC`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, spellId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.known_spells (character_id, spell_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, spell_id) DO NOTHING
       RETURNING *`,
      [characterId, spellId]
    );
    return rows[0] || null;
  },

  async patch(characterId, spellId, { mastered, cast_count }) {
    // Auto-master after 3 casts
    const effectiveMastered = mastered ?? (cast_count >= 3 ? true : undefined);

    const { rows } = await pool.query(
      `UPDATE character_sheet.known_spells
       SET mastered   = COALESCE($3, mastered),
           cast_count = COALESCE($4, cast_count)
       WHERE character_id = $1 AND spell_id = $2
       RETURNING *`,
      [characterId, spellId, effectiveMastered ?? null, cast_count ?? null]
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
