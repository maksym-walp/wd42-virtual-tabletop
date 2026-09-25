const express = require('express');
const AbilityController = require('../controllers/ability.controller');
const { requireAuth, requireCanonicalManager, requireAdminOwner } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(AbilityController.list));
router.post('/',       requireAuth, wrap(AbilityController.create));
// export/import мусять стояти ДО GET /:id — інакше той прийме "export"/"import"
// за id (той самий патерн, що й у services/equipment/src/routes/catalog.routes.js).
router.get('/export',  requireAuth, wrap(AbilityController.export));
router.post('/import', requireCanonicalManager, wrap(AbilityController.import));
router.get('/:id',     requireAuth, wrap(AbilityController.getOne));
router.put('/:id',     requireAuth, wrap(AbilityController.update));
router.delete('/:id',  requireAuth, wrap(AbilityController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(AbilityController.setCanonical));
router.patch('/:id/owner', requireAdminOwner, wrap(AbilityController.setOwner));

module.exports = router;
