const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CampaignController = require('../controllers/campaign.controller');
const CampaignCharacterController = require('../controllers/campaign-character.controller');
const CampaignGalleryController = require('../controllers/campaign-gallery.controller');
const CampaignMapController = require('../controllers/campaign-map.controller');
const CampaignSessionController = require('../controllers/campaign-session.controller');
const CombatController = require('../controllers/combat.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.post('/join', wrap(CampaignCharacterController.join));

router.post('/', wrap(CampaignController.create));
router.get('/', wrap(CampaignController.listMine));
router.get('/:id', wrap(CampaignController.getOne));
router.patch('/:id', wrap(CampaignController.rename));
router.delete('/:id', wrap(CampaignController.remove));
router.patch('/:id/shared-notes', wrap(CampaignController.updateSharedNotes));
router.patch('/:id/gm-notes', wrap(CampaignController.updateGmNotes));
router.patch('/:id/description', wrap(CampaignController.updateDescription));

router.post('/:id/characters', wrap(CampaignCharacterController.addByGm));
router.get('/:id/characters', wrap(CampaignCharacterController.list));
router.delete('/:id/characters/:characterId', wrap(CampaignCharacterController.remove));
router.post('/:id/leave', wrap(CampaignCharacterController.leave));

router.get('/:id/gallery', wrap(CampaignGalleryController.list));
router.post('/:id/gallery', wrap(CampaignGalleryController.add));
router.delete('/:id/gallery/:imageId', wrap(CampaignGalleryController.remove));

router.get('/:id/maps', wrap(CampaignMapController.list));
router.post('/:id/maps', wrap(CampaignMapController.add));
router.delete('/:id/maps/:cardId', wrap(CampaignMapController.remove));

router.get('/:id/sessions', wrap(CampaignSessionController.list));
router.post('/:id/sessions', wrap(CampaignSessionController.add));
router.patch('/:id/sessions/:sessionId', wrap(CampaignSessionController.update));
router.delete('/:id/sessions/:sessionId', wrap(CampaignSessionController.remove));

router.get('/:id/combat', wrap(CombatController.getCurrent));
router.post('/:id/combat/next-turn', wrap(CombatController.nextTurn));
router.post('/:id/combat/next-round', wrap(CombatController.nextRound));
router.post('/:id/combat/scenes', wrap(CombatController.createScene));
router.patch('/:id/combat/scenes/:sceneId', wrap(CombatController.updateScene));
router.delete('/:id/combat/scenes/:sceneId', wrap(CombatController.removeScene));
router.post('/:id/combat/scenes/:sceneId/combatants', wrap(CombatController.addCombatant));
router.patch('/:id/combat/combatants/:combatantId', wrap(CombatController.updateCombatant));
router.delete('/:id/combat/combatants/:combatantId', wrap(CombatController.removeCombatant));

module.exports = router;
