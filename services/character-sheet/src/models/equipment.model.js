const pool = require('../config/db');

const EquipmentModel = {
  // LEFT JOIN cross-schema into equipment.items so the sheet can render the
  // item's name/description/stats read-only even when the viewer isn't its
  // owner and it's private — visibility onto the sheet itself is already
  // gated by character.controller's is_owner/is_public/GM check.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ce.*,
              CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'damage_die', ei.damage_die, 'defense_value', ei.defense_value,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'armor_weight', ei.armor_weight, 'creator', ei.creator, 'rarity', ei.rarity
              ) END AS item
       FROM character_sheet.equipment ce
       LEFT JOIN equipment.items ei ON ei.id = ce.equipment_id
       WHERE ce.character_id = $1
       ORDER BY ce.mastered ASC, ce.mastery_count DESC`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, equipmentId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.equipment (character_id, equipment_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, equipment_id) DO NOTHING
       RETURNING *`,
      [characterId, equipmentId]
    );
    return rows[0] || null;
  },

  async patch(characterId, equipmentId, { mastery_count, mastered }) {
    // Auto-master when mastery_count reaches 3
    const effectiveMastered = mastered ?? (mastery_count >= 3 ? true : undefined);

    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE character_sheet.equipment
         SET mastery_count = COALESCE($3, mastery_count),
             mastered      = COALESCE($4, mastered)
         WHERE character_id = $1 AND equipment_id = $2
         RETURNING *
       )
       SELECT ce.*,
              CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'damage_die', ei.damage_die, 'defense_value', ei.defense_value,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'armor_weight', ei.armor_weight, 'creator', ei.creator, 'rarity', ei.rarity
              ) END AS item
       FROM updated ce
       LEFT JOIN equipment.items ei ON ei.id = ce.equipment_id`,
      [characterId, equipmentId, mastery_count ?? null, effectiveMastered ?? null]
    );
    return rows[0] || null;
  },

  async remove(characterId, equipmentId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.equipment WHERE character_id = $1 AND equipment_id = $2`,
      [characterId, equipmentId]
    );
    return rowCount > 0;
  },
};

module.exports = EquipmentModel;
