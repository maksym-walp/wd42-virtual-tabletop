const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const MapController = require('../controllers/map.controller');
const MapLensController = require('../controllers/map-lens.controller');
const MapLensVersionController = require('../controllers/map-lens-version.controller');
const MapPinController = require('../controllers/map-pin.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

// Maps (standalone)
router.get('/', wrap(MapController.list));
router.post('/', wrap(MapController.create));
router.get('/:id', wrap(MapController.getOne));
router.patch('/:id', wrap(MapController.update));
router.delete('/:id', wrap(MapController.remove));

// Lenses (image layers of a map)
router.get('/:mapId/lenses', wrap(MapLensController.list));
router.post('/:mapId/lenses', wrap(MapLensController.add));
router.patch('/:mapId/lenses/:lensId', wrap(MapLensController.update));
router.delete('/:mapId/lenses/:lensId', wrap(MapLensController.remove));

// Dated image versions of a lens (the timeline)
router.post('/:mapId/lenses/:lensId/versions', wrap(MapLensVersionController.add));
router.patch('/:mapId/lenses/:lensId/versions/:versionId', wrap(MapLensVersionController.update));
router.delete('/:mapId/lenses/:lensId/versions/:versionId', wrap(MapLensVersionController.remove));

// Pins (a location placed on a map)
router.get('/:mapId/pins', wrap(MapPinController.list));
router.post('/:mapId/pins', wrap(MapPinController.add));
router.patch('/:mapId/pins/:pinId', wrap(MapPinController.update));
router.delete('/:mapId/pins/:pinId', wrap(MapPinController.remove));

module.exports = router;
