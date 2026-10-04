const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const NpcController = require('../controllers/npc.controller');
const NpcFactionController = require('../controllers/npc-faction.controller');
const RelationshipController = require('../controllers/relationship.controller');
const NpcModel = require('../models/npc.model');
const { buildRelationModels } = require('../models/relations.model');
const { buildLoadoutControllers, mountLoadoutRoutes } = require('../controllers/loadout.controllers');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(NpcController.list));
router.post('/', wrap(NpcController.create));
router.get('/:id', wrap(NpcController.getOne));
router.patch('/:id', wrap(NpcController.update));
router.patch('/:id/owner', wrap(NpcController.setOwner));
router.delete('/:id', wrap(NpcController.remove));
router.patch('/:id/health', wrap(NpcController.updateHealth));

// Cross-service loadout: equipment, known spells, known abilities.
mountLoadoutRoutes(router, wrap, buildLoadoutControllers(NpcModel, buildRelationModels('npcs', 'npc')));

// Faction membership from the NPC's side (same rows as /factions/:id/members).
router.get('/:id/factions', wrap(NpcFactionController.list));
router.post('/:id/factions', wrap(NpcFactionController.add));
router.patch('/:id/factions/:factionId', wrap(NpcFactionController.update));
router.delete('/:id/factions/:factionId', wrap(NpcFactionController.remove));

// Directed relationships to other NPCs / player characters.
router.get('/:id/relationships', wrap(RelationshipController.list));
router.post('/:id/relationships', wrap(RelationshipController.create));
router.patch('/:id/relationships/:relationshipId', wrap(RelationshipController.update));
router.delete('/:id/relationships/:relationshipId', wrap(RelationshipController.remove));

module.exports = router;
