const express = require('express');
const ItemController = require('../controllers/item.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(ItemController.list));
router.post('/',       requireAuth, wrap(ItemController.create));
router.get('/:id',     requireAuth, wrap(ItemController.getOne));
router.put('/:id',     requireAuth, wrap(ItemController.update));
router.delete('/:id',  requireAuth, wrap(ItemController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(ItemController.setCanonical));

module.exports = router;
