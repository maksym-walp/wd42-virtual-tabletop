const pool = require('../config/db');

// Equipment is split across equipment.items/weapons/armor (39-equipment-split-tables.sql)
// — there is no single "equipment" table. Row ids are preserved across the split, so a
// bare equipment_id resolves against the union of all three. Mirrors character-sheet's
// equipment.model.js CATALOG (columns trimmed to what compendium needs to display).
const EQUIPMENT_CATALOG_TABLES = ['equipment.items', 'equipment.weapons', 'equipment.armor'];

const EQUIPMENT_CATALOG = `(
        SELECT id, name, 'item'::varchar AS type,
               description, is_public, price, image_url,
               NULL::varchar AS damage_die, NULL::varchar AS weapon_type, NULL::varchar[] AS weapon_grip,
               NULL::smallint AS defense_value, NULL::varchar AS armor_weight
        FROM equipment.items
        UNION ALL
        SELECT id, name, 'weapon'::varchar,
               description, is_public, price, image_url,
               damage_die, weapon_type, weapon_grip,
               NULL::smallint, NULL::varchar
        FROM equipment.weapons
        UNION ALL
        SELECT id, name, 'armor'::varchar,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar, NULL::varchar[],
               defense_value, armor_weight
        FROM equipment.armor
      )`;

// sourceTable is always a fixed literal from our own code, never user input.
// A catalog entry is visible to a user if they own it or it's marked public —
// mirrors character-sheet's prerequisite.model.js isVisibleToUser.
async function isVisibleToUser(sourceTable, itemId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM ${sourceTable} WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
    [itemId, userId]
  );
  return rows.length > 0;
}

// Equipment has no single source table — check items/weapons/armor in turn.
async function isEquipmentVisibleToUser(equipmentId, userId) {
  for (const table of EQUIPMENT_CATALOG_TABLES) {
    if (await isVisibleToUser(table, equipmentId, userId)) return true;
  }
  return false;
}

module.exports = { EQUIPMENT_CATALOG, isVisibleToUser, isEquipmentVisibleToUser };
