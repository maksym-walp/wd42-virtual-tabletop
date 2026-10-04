const pool = require('../config/db');
const { EQUIPMENT_CATALOG } = require('./catalog.model');

// Junction models for a stat-block record's loadout: equipment, known spells,
// known abilities. All three share one shape (FK+CASCADE on the owning side, a
// bare cross-schema UUID on the other, UNIQUE pair), differing only in the
// table, the external id column and the cross-schema LEFT JOIN that resolves
// the external row for display. `table`/`column` values below are fixed
// literals from this file, never user input.
function createRelationModel({ table, parentColumn, externalColumn, resultKey, select, join }) {
  return {
    async findAllByEntry(parentId) {
      const { rows } = await pool.query(
        `SELECT r.*, CASE WHEN x.id IS NULL THEN NULL ELSE ${select} END AS ${resultKey}
         FROM ${table} r
         LEFT JOIN ${join} x ON x.id = r.${externalColumn}
         WHERE r.${parentColumn} = $1
         ORDER BY r.created_at ASC`,
        [parentId]
      );
      return rows;
    },

    async add(parentId, externalId) {
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${parentColumn}, ${externalColumn})
         VALUES ($1, $2)
         ON CONFLICT (${parentColumn}, ${externalColumn}) DO NOTHING
         RETURNING *`,
        [parentId, externalId]
      );
      return rows[0] || null;
    },

    async remove(parentId, externalId) {
      const { rowCount } = await pool.query(
        `DELETE FROM ${table} WHERE ${parentColumn} = $1 AND ${externalColumn} = $2`,
        [parentId, externalId]
      );
      return rowCount > 0;
    },
  };
}

// Equipment is split across equipment.items/weapons/armor — resolved against
// their union (see catalog.model.js).
const EQUIPMENT_SELECT = `jsonb_build_object(
    'id', x.id, 'name', x.name, 'type', x.type,
    'description', x.description, 'is_public', x.is_public,
    'price', x.price, 'image_url', x.image_url,
    'damage_die', x.damage_die, 'weapon_type', x.weapon_type, 'weapon_grip', x.weapon_grip,
    'defense_value', x.defense_value, 'armor_weight', x.armor_weight
  )`;

const SPELL_SELECT = `jsonb_build_object(
    'id', x.id, 'name', x.name, 'spell_kind', x.spell_kind,
    'energy_cost', x.energy_cost, 'is_public', x.is_public
  )`;

const ABILITY_SELECT = `jsonb_build_object(
    'id', x.id, 'name', x.name, 'is_maneuver', x.is_maneuver,
    'duration_value', x.duration_value, 'duration_unit', x.duration_unit,
    'mechanical_desc', x.mechanical_desc, 'narrative_desc', x.narrative_desc, 'is_public', x.is_public
  )`;

// schema/prefix: e.g. ('bestiary', 'creature') -> bestiary.creature_equipment
// with a creature_id parent column.
function buildRelationModels(schema, prefix) {
  const parentColumn = `${prefix}_id`;
  return {
    EquipmentModel: createRelationModel({
      table: `${schema}.${prefix}_equipment`, parentColumn, externalColumn: 'equipment_id',
      resultKey: 'equipment', select: EQUIPMENT_SELECT, join: EQUIPMENT_CATALOG,
    }),
    SpellModel: createRelationModel({
      table: `${schema}.${prefix}_spells`, parentColumn, externalColumn: 'spell_id',
      resultKey: 'spell', select: SPELL_SELECT, join: 'spellbook.spells',
    }),
    AbilityModel: createRelationModel({
      table: `${schema}.${prefix}_abilities`, parentColumn, externalColumn: 'ability_id',
      resultKey: 'ability', select: ABILITY_SELECT, join: 'abilities.entries',
    }),
  };
}

module.exports = { createRelationModel, buildRelationModels };
