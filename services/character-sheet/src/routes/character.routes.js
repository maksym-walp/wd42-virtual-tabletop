const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const CharacterController = require('../controllers/character.controller');
const SkillController = require('../controllers/skill.controller');
const SpellController = require('../controllers/spell.controller');
const TreeProgressController = require('../controllers/tree-progress.controller');
const NephilimController = require('../controllers/nephilim.controller');
const EquipmentController = require('../controllers/equipment.controller');
const ManeuverController = require('../controllers/maneuver.controller');
const AbilityController = require('../controllers/ability.controller');
const RitualTrackerController = require('../controllers/ritual-tracker.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public character view (no auth required)
router.get('/public/:id', wrap(CharacterController.getPublicSheet));

// All other routes require auth
router.use(requireAuth);

// Characters
router.get('/',       wrap(CharacterController.list));
router.get('/community', wrap(CharacterController.listCommunity));
router.post('/',      wrap(CharacterController.create));
router.get('/:id',    wrap(CharacterController.getSheet));
router.put('/:id',    wrap(CharacterController.update));
router.delete('/:id', wrap(CharacterController.remove));

// Skills
router.get('/:id/skills',         wrap(SkillController.getAll));
router.put('/:id/skills',         wrap(SkillController.bulkUpdate));
router.patch('/:id/skills/:key',  wrap(SkillController.patch));

// Spells
router.get('/:id/spells',               wrap(SpellController.list));
router.post('/:id/spells',              wrap(SpellController.add));
router.patch('/:id/spells/:spellId',    wrap(SpellController.patch));
router.delete('/:id/spells/:spellId',   wrap(SpellController.remove));

// Skill tree progress
router.get('/:id/tree',             wrap(TreeProgressController.list));
router.post('/:id/tree/:nodeId',    wrap(TreeProgressController.unlock));
router.delete('/:id/tree/:nodeId',  wrap(TreeProgressController.lock));

// Nephilim breakthroughs
router.get('/:id/tree/breakthroughs',              wrap(NephilimController.list));
router.post('/:id/tree/breakthroughs/:nodeId',     wrap(NephilimController.use));
router.delete('/:id/tree/breakthroughs/:nodeId',   wrap(NephilimController.revoke));

// Equipment (references equipment.items catalog)
router.get('/:id/equipment',                 wrap(EquipmentController.list));
router.post('/:id/equipment',                wrap(EquipmentController.add));
router.patch('/:id/equipment/:equipmentId',  wrap(EquipmentController.patch));
router.delete('/:id/equipment/:equipmentId', wrap(EquipmentController.remove));

// Maneuvers (fighter) — references maneuvers.entries catalog
router.get('/:id/maneuvers',                wrap(ManeuverController.list));
router.post('/:id/maneuvers',               wrap(ManeuverController.add));
router.delete('/:id/maneuvers/:maneuverId', wrap(ManeuverController.remove));

// Abilities (вміння, all archetypes) — references abilities.entries catalog
router.get('/:id/abilities',               wrap(AbilityController.list));
router.post('/:id/abilities',              wrap(AbilityController.add));
router.delete('/:id/abilities/:abilityId', wrap(AbilityController.remove));

// Ritual trackers (spellcaster)
router.get('/:id/rituals',            wrap(RitualTrackerController.list));
router.post('/:id/rituals',           wrap(RitualTrackerController.create));
router.put('/:id/rituals/:trackerId', wrap(RitualTrackerController.update));
router.delete('/:id/rituals/:trackerId', wrap(RitualTrackerController.remove));

module.exports = router;
