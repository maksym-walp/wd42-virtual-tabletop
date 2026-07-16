const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CampaignController = require('../controllers/campaign.controller');
const CampaignCharacterController = require('../controllers/campaign-character.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.post('/join', wrap(CampaignCharacterController.join));

router.post('/', wrap(CampaignController.create));
router.get('/', wrap(CampaignController.listMine));
router.get('/:id', wrap(CampaignController.getOne));
router.patch('/:id/shared-notes', wrap(CampaignController.updateSharedNotes));
router.patch('/:id/gm-notes', wrap(CampaignController.updateGmNotes));

router.post('/:id/characters', wrap(CampaignCharacterController.addByGm));
router.get('/:id/characters', wrap(CampaignCharacterController.list));

module.exports = router;
