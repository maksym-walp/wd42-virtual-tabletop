const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CreatureController = require('../controllers/creature.controller');
const CreatureModel = require('../models/creature.model');
const { buildRelationModels } = require('../models/relations.model');
const { buildLoadoutControllers, mountLoadoutRoutes } = require('../controllers/loadout.controllers');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(CreatureController.list));
router.post('/', wrap(CreatureController.create));
router.get('/:id', wrap(CreatureController.getOne));
router.patch('/:id', wrap(CreatureController.update));
router.patch('/:id/owner', wrap(CreatureController.setOwner));
router.delete('/:id', wrap(CreatureController.remove));

// Cross-service loadout: equipment, known spells, known abilities.
mountLoadoutRoutes(router, wrap, buildLoadoutControllers(CreatureModel, buildRelationModels('bestiary', 'creature')));

module.exports = router;
