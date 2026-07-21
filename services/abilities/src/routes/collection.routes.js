const express = require('express');
const CollectionController = require('../controllers/collection.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Unauthenticated share link — mirrors character_sheet's GET /public/:id.
router.get('/public/:id', wrap(CollectionController.getPublic));

router.get('/',    requireAuth, wrap(CollectionController.list));
router.post('/',   requireAuth, wrap(CollectionController.create));
router.get('/:id', requireAuth, wrap(CollectionController.getOne));
router.put('/:id', requireAuth, wrap(CollectionController.update));
router.delete('/:id', requireAuth, wrap(CollectionController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(CollectionController.setCanonical));

router.post('/:id/items',           requireAuth, wrap(CollectionController.addItem));
router.delete('/:id/items/:itemId', requireAuth, wrap(CollectionController.removeItem));

module.exports = router;
