const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CampaignController = require('../controllers/campaign.controller');
const CampaignCharacterController = require('../controllers/campaign-character.controller');
const BoardController = require('../controllers/board.controller');
const EventsController = require('../controllers/events.controller');
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
router.patch('/:id/gm-notes', wrap(CampaignController.updateGmNotes));
router.patch('/:id/description', wrap(CampaignController.updateDescription));
router.patch('/:id/date', wrap(CampaignController.updateCurrentDate));
router.post('/:id/invite-code/regenerate', wrap(CampaignController.regenerateInviteCode));

// Server-Sent Events: сповіщення відкритих вкладок про зміни в кампанії.
router.get('/:id/events', wrap(EventsController.stream));

router.post('/:id/characters', wrap(CampaignCharacterController.addByGm));
router.get('/:id/characters', wrap(CampaignCharacterController.list));
router.delete('/:id/characters/:characterId', wrap(CampaignCharacterController.remove));
router.post('/:id/characters/experience', wrap(CampaignCharacterController.grantExperience));
router.post('/:id/leave', wrap(CampaignCharacterController.leave));

// Стіл (zone=table) і Ширма (zone=screen)
router.get('/:id/board', wrap(BoardController.list));
router.post('/:id/board', wrap(BoardController.add));
router.put('/:id/board/order', wrap(BoardController.reorder));
router.patch('/:id/board/:itemId', wrap(BoardController.update));
router.post('/:id/board/:itemId/refresh', wrap(BoardController.refresh));
router.delete('/:id/board/:itemId', wrap(BoardController.remove));

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

// Не прив'язаний до конкретної кампанії: лист персонажа не знає, у якому бою
// (якщо взагалі) цей персонаж зараз перебуває.
router.patch('/characters/:characterId/hp', wrap(CombatController.syncHpFromCharacterSheet));

module.exports = router;
