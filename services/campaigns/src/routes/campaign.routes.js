const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CampaignController = require('../controllers/campaign.controller');
const CampaignCharacterController = require('../controllers/campaign-character.controller');
const CampaignGalleryController = require('../controllers/campaign-gallery.controller');

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

router.post('/:id/characters', wrap(CampaignCharacterController.addByGm));
router.get('/:id/characters', wrap(CampaignCharacterController.list));
router.delete('/:id/characters/:characterId', wrap(CampaignCharacterController.remove));

router.get('/:id/gallery', wrap(CampaignGalleryController.list));
router.post('/:id/gallery', wrap(CampaignGalleryController.add));
router.delete('/:id/gallery/:imageId', wrap(CampaignGalleryController.remove));

module.exports = router;
