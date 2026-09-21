const createRelationController = require('./relation.controller');
const EntryEquipmentModel = require('../models/entry-equipment.model');
const EntrySpellModel = require('../models/entry-spell.model');
const EntryAbilityModel = require('../models/entry-ability.model');
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

const AbilityRelationController = createRelationController({
  RelationModel: EntryAbilityModel,
  checkVisible: (id, userId) => isVisibleToUser('abilities.entries', id, userId),
  bodyField: 'ability_id',
  paramField: 'abilityId',
  listKey: 'abilities',
  itemKey: 'ability',
  notFoundMessage: 'Вміння не знайдено',
});

module.exports = { EquipmentRelationController, SpellRelationController, AbilityRelationController };
