const pool = require('../config/db');
const { EQUIPMENT_CATALOG } = require('./catalog.model');

// LEFT JOIN cross-schema into the equipment union — see catalog.model.js for rationale.
const EntryEquipmentModel = {
  async findAllByEntry(entryId) {
    const { rows } = await pool.query(
      `SELECT ce.*,
              CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'damage_die', ei.damage_die, 'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'defense_value', ei.defense_value, 'armor_weight', ei.armor_weight
              ) END AS equipment
       FROM compendium.compendium_equipment ce
       LEFT JOIN ${EQUIPMENT_CATALOG} ei ON ei.id = ce.equipment_id
       WHERE ce.entry_id = $1
       ORDER BY ce.created_at ASC`,
      [entryId]
    );
    return rows;
  },

  async add(entryId, equipmentId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.compendium_equipment (entry_id, equipment_id)
       VALUES ($1, $2)
       ON CONFLICT (entry_id, equipment_id) DO NOTHING
       RETURNING *`,
      [entryId, equipmentId]
    );
    return rows[0] || null;
  },

  async remove(entryId, equipmentId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.compendium_equipment WHERE entry_id = $1 AND equipment_id = $2`,
      [entryId, equipmentId]
    );
    return rowCount > 0;
  },
};

module.exports = EntryEquipmentModel;
