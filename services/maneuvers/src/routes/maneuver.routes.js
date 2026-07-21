const express = require('express');
const ManeuverController = require('../controllers/maneuver.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(ManeuverController.list));
router.post('/',       requireAuth, wrap(ManeuverController.create));
router.get('/:id',     requireAuth, wrap(ManeuverController.getOne));
router.put('/:id',     requireAuth, wrap(ManeuverController.update));
router.delete('/:id',  requireAuth, wrap(ManeuverController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(ManeuverController.setCanonical));

module.exports = router;
