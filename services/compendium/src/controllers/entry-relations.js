const createRelationController = require('./relation.controller');
const EntryEquipmentModel = require('../models/entry-equipment.model');
const EntrySpellModel = require('../models/entry-spell.model');
const EntryManeuverModel = require('../models/entry-maneuver.model');
const { isVisibleToUser, isEquipmentVisibleToUser } = require('../models/catalog.model');

const EquipmentRelationController = createRelationController({
  RelationModel: EntryEquipmentModel,
  checkVisible: isEquipmentVisibleToUser,
  bodyField: 'equipment_id',
  paramField: 'equipmentId',
  listKey: 'equipment',
  itemKey: 'item',
  notFoundMessage: 'Спорядження не знайдено',
});

const SpellRelationController = createRelationController({
  RelationModel: EntrySpellModel,
  checkVisible: (id, userId) => isVisibleToUser('spellbook.spells', id, userId),
  bodyField: 'spell_id',
  paramField: 'spellId',
  listKey: 'spells',
  itemKey: 'spell',
  notFoundMessage: 'Заклинання не знайдено',
});

const ManeuverRelationController = createRelationController({
  RelationModel: EntryManeuverModel,
  checkVisible: (id, userId) => isVisibleToUser('maneuvers.entries', id, userId),
  bodyField: 'maneuver_id',
  paramField: 'maneuverId',
  listKey: 'maneuvers',
  itemKey: 'maneuver',
  notFoundMessage: 'Маневр не знайдено',
});

module.exports = { EquipmentRelationController, SpellRelationController, ManeuverRelationController };
