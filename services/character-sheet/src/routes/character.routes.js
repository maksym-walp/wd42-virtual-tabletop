const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const CharacterController = require('../controllers/character.controller');
const SkillController = require('../controllers/skill.controller');
const SpellController = require('../controllers/spell.controller');
const TreeProgressController = require('../controllers/tree-progress.controller');
const EquipmentController = require('../controllers/equipment.controller');
const AbilityController = require('../controllers/ability.controller');
const RitualTrackerController = require('../controllers/ritual-tracker.controller');
const ConfigController = require('../controllers/config.controller');
const RestController = require('../controllers/rest.controller');
const TimerController = require('../controllers/timer.controller');
const EffectsController = require('../controllers/effects.controller');
const CombatController = require('../controllers/combat.controller');
const PotionController = require('../controllers/potion.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public character view (no auth required)
router.get('/public/:id', wrap(CharacterController.getPublicSheet));

// All other routes require auth
router.use(requireAuth);

// Characters
router.get('/',       wrap(CharacterController.list));
router.get('/community', wrap(CharacterController.listCommunity));
// Перед /:id, інакше 'config' сприймався б як id персонажа.
router.get('/config', wrap(ConfigController.getCharacterConfig));
// Пакетні ефекти станів (трекер бою) і таймер діяльності (лише ГМ) — теж до /:id.
router.get('/effects', wrap(EffectsController.list));
router.post('/timer/advance', wrap(TimerController.advance));
router.post('/',      wrap(CharacterController.create));
router.get('/:id',    wrap(CharacterController.getSheet));
router.put('/:id',    wrap(CharacterController.update));
router.put('/:id/people', wrap(CharacterController.setPeople));
router.delete('/:id', wrap(CharacterController.remove));
router.patch('/:id/owner', requireAdmin, wrap(CharacterController.setOwner));
router.post('/:id/duplicate', wrap(CharacterController.duplicate));
router.get('/:id/rest/preview', wrap(RestController.preview));
router.post('/:id/rest', wrap(RestController.rest));
// Бойові наслідки: шкода (з поглинанням, порахованим трекером) і рятівні кидки.
router.post('/:id/damage', wrap(CombatController.damage));
router.post('/:id/death-save', wrap(CombatController.deathSave));

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

// Equipment (references equipment.items catalog)
router.get('/:id/equipment',                 wrap(EquipmentController.list));
router.post('/:id/equipment',                wrap(EquipmentController.add));
router.patch('/:id/equipment/:equipmentId',  wrap(EquipmentController.patch));
router.delete('/:id/equipment/:equipmentId', wrap(EquipmentController.remove));
router.post('/:id/equipment/:equipmentId/drink', wrap(PotionController.drink));

// Abilities (вміння, all archetypes) — references abilities.entries catalog
router.get('/:id/abilities',               wrap(AbilityController.list));
router.post('/:id/abilities',              wrap(AbilityController.add));
router.patch('/:id/abilities/:abilityId',  wrap(AbilityController.patch));
router.delete('/:id/abilities/:abilityId', wrap(AbilityController.remove));

// Ritual trackers (spellcaster)
router.get('/:id/rituals',            wrap(RitualTrackerController.list));
router.post('/:id/rituals',           wrap(RitualTrackerController.create));
router.put('/:id/rituals/:trackerId', wrap(RitualTrackerController.update));
router.delete('/:id/rituals/:trackerId', wrap(RitualTrackerController.remove));

module.exports = router;
