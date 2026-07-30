const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CollectionController = require('../controllers/collection.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Unauthenticated share link — mirrors equipment/spellbook/maneuvers collections.
router.get('/public/:id', wrap(CollectionController.getPublic));

router.use(requireAuth);

router.get('/', wrap(CollectionController.list));
router.post('/', wrap(CollectionController.create));
router.get('/:id', wrap(CollectionController.getOne));
router.put('/:id', wrap(CollectionController.update));
router.delete('/:id', wrap(CollectionController.remove));

router.post('/:id/items', wrap(CollectionController.addItem));
router.delete('/:id/items/:entryId', wrap(CollectionController.removeItem));

module.exports = router;
