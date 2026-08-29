const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const LocationController = require('../controllers/location.controller');
const LocationVersionController = require('../controllers/location-version.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(LocationController.listMine));
router.post('/', wrap(LocationController.create));

// export/import must stand before GET /:id — otherwise it takes "export" for an id
// (same pattern as the equipment catalog's union router).
router.get('/export', wrap(LocationController.export));
router.post('/import', wrap(LocationController.import));

router.get('/:id', wrap(LocationController.getOne));
router.patch('/:id', wrap(LocationController.update));
router.delete('/:id', wrap(LocationController.remove));

// Chronological versions of a location's lore.
router.post('/:id/versions', wrap(LocationVersionController.add));
router.patch('/:id/versions/:versionId', wrap(LocationVersionController.update));
router.delete('/:id/versions/:versionId', wrap(LocationVersionController.remove));

module.exports = router;
