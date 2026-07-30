const pool = require('../config/db');

// LEFT JOIN cross-schema into spellbook.spells — single table, no union needed.
const EntrySpellModel = {
  async findAllByEntry(entryId) {
    const { rows } = await pool.query(
      `SELECT cs.*,
              CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', sp.id, 'name', sp.name, 'spell_kind', sp.spell_kind,
                'energy_cost', sp.energy_cost, 'is_public', sp.is_public
              ) END AS spell
       FROM compendium.compendium_spells cs
       LEFT JOIN spellbook.spells sp ON sp.id = cs.spell_id
       WHERE cs.entry_id = $1
       ORDER BY cs.created_at ASC`,
      [entryId]
    );
    return rows;
  },

  async add(entryId, spellId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.compendium_spells (entry_id, spell_id)
       VALUES ($1, $2)
       ON CONFLICT (entry_id, spell_id) DO NOTHING
       RETURNING *`,
      [entryId, spellId]
    );
    return rows[0] || null;
  },

  async remove(entryId, spellId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.compendium_spells WHERE entry_id = $1 AND spell_id = $2`,
      [entryId, spellId]
    );
    return rowCount > 0;
  },
};

module.exports = EntrySpellModel;
