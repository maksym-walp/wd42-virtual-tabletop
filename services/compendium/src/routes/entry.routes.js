const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const EntryController = require('../controllers/entry.controller');
const { EquipmentRelationController, SpellRelationController, ManeuverRelationController } = require('../controllers/entry-relations');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(EntryController.list));
router.post('/', wrap(EntryController.create));
router.get('/:id', wrap(EntryController.getOne));
router.patch('/:id', wrap(EntryController.update));
router.delete('/:id', wrap(EntryController.remove));
router.patch('/:id/health', wrap(EntryController.updateHealth));

// Cross-service associations: equipment loadout, known spells, known maneuvers.
router.get('/:id/equipment', wrap(EquipmentRelationController.list));
router.post('/:id/equipment', wrap(EquipmentRelationController.add));
router.delete('/:id/equipment/:equipmentId', wrap(EquipmentRelationController.remove));

router.get('/:id/spells', wrap(SpellRelationController.list));
router.post('/:id/spells', wrap(SpellRelationController.add));
router.delete('/:id/spells/:spellId', wrap(SpellRelationController.remove));

router.get('/:id/maneuvers', wrap(ManeuverRelationController.list));
router.post('/:id/maneuvers', wrap(ManeuverRelationController.add));
router.delete('/:id/maneuvers/:maneuverId', wrap(ManeuverRelationController.remove));

module.exports = router;
