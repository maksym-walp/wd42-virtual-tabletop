const createRelationController = require('./relation.controller');
const { isVisibleToUser, isEquipmentVisibleToUser } = require('../models/catalog.model');

// The three loadout relations (equipment / known spells / known abilities)
// of one stat-block record type, wired to that type's ParentModel and the
// junction models from relations.model.js buildRelationModels().
function buildLoadoutControllers(ParentModel, { EquipmentModel, SpellModel, AbilityModel }) {
  return {
    EquipmentRelationController: createRelationController({
      ParentModel,
      RelationModel: EquipmentModel,
      checkVisible: isEquipmentVisibleToUser,
      bodyField: 'equipment_id',
      paramField: 'equipmentId',
      listKey: 'equipment',
      itemKey: 'item',
      notFoundMessage: 'Спорядження не знайдено',
    }),
    SpellRelationController: createRelationController({
      ParentModel,
      RelationModel: SpellModel,
      checkVisible: (id, userId) => isVisibleToUser('spellbook.spells', id, userId),
      bodyField: 'spell_id',
      paramField: 'spellId',
      listKey: 'spells',
      itemKey: 'spell',
      notFoundMessage: 'Заклинання не знайдено',
    }),
    AbilityRelationController: createRelationController({
      ParentModel,
      RelationModel: AbilityModel,
      checkVisible: (id, userId) => isVisibleToUser('abilities.entries', id, userId),
      bodyField: 'ability_id',
      paramField: 'abilityId',
      listKey: 'abilities',
      itemKey: 'ability',
      notFoundMessage: 'Вміння не знайдено',
    }),
  };
}

// Mounts GET/POST /:id/<relation> and DELETE /:id/<relation>/:<param> for all three.
function mountLoadoutRoutes(router, wrap, controllers) {
  const { EquipmentRelationController: eq, SpellRelationController: sp, AbilityRelationController: ab } = controllers;
  router.get('/:id/equipment', wrap(eq.list));
  router.post('/:id/equipment', wrap(eq.add));
  router.delete('/:id/equipment/:equipmentId', wrap(eq.remove));

  router.get('/:id/spells', wrap(sp.list));
  router.post('/:id/spells', wrap(sp.add));
  router.delete('/:id/spells/:spellId', wrap(sp.remove));

  router.get('/:id/abilities', wrap(ab.list));
  router.post('/:id/abilities', wrap(ab.add));
  router.delete('/:id/abilities/:abilityId', wrap(ab.remove));
}

module.exports = { buildLoadoutControllers, mountLoadoutRoutes };
