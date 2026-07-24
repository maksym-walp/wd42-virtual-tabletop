const express = require('express');
const TraditionController = require('../controllers/tradition.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(TraditionController.list));
router.get('/:id',     requireAuth, wrap(TraditionController.getOne));
router.post('/',       requireCanonicalManager, wrap(TraditionController.create));
router.put('/:id',     requireCanonicalManager, wrap(TraditionController.update));
router.delete('/:id',  requireCanonicalManager, wrap(TraditionController.remove));

// Any spell owner (or admin) may attach/detach existing traditions on their
// own spell — ownership enforced inside TraditionModel against the spell.
router.post('/:id/spells',            requireAuth, wrap(TraditionController.addSpell));
router.delete('/:id/spells/:spellId', requireAuth, wrap(TraditionController.removeSpell));

module.exports = router;
