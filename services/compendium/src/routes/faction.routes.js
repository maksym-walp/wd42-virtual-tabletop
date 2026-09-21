const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const FactionController = require('../controllers/faction.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(FactionController.list));
router.post('/', wrap(FactionController.create));
router.get('/:id', wrap(FactionController.getOne));
router.patch('/:id', wrap(FactionController.update));
router.delete('/:id', wrap(FactionController.remove));

router.get('/:id/leaders', wrap(FactionController.listLeaders));
router.post('/:id/leaders', wrap(FactionController.addLeader));
router.delete('/:id/leaders/:npcId', wrap(FactionController.removeLeader));

router.get('/:id/members', wrap(FactionController.listMembers));
router.post('/:id/members', wrap(FactionController.addMember));
router.delete('/:id/members/:memberType/:memberId', wrap(FactionController.removeMember));

module.exports = router;
