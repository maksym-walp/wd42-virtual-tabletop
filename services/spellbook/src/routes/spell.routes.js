const express = require('express');
const SpellController = require('../controllers/spell.controller');
const { requireAuth, requireCanonicalManager, requireAdminOwner } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(SpellController.list));
router.post('/',       requireAuth, wrap(SpellController.create));
// export/import мусять стояти ДО GET /:id — інакше той прийме "export"/
// "import" за id (той самий патерн, що й в services/equipment).
router.get('/export',  requireAuth, wrap(SpellController.export));
router.post('/import', requireCanonicalManager, wrap(SpellController.import));
router.get('/:id',     requireAuth, wrap(SpellController.getOne));
router.get('/:id/tree', requireAuth, wrap(SpellController.tree));
router.put('/:id',     requireAuth, wrap(SpellController.update));
router.delete('/:id',  requireAuth, wrap(SpellController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(SpellController.setCanonical));
router.patch('/:id/owner', requireAdminOwner, wrap(SpellController.setOwner));

module.exports = router;
