const express = require('express');
const SpellController = require('../controllers/spell.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(SpellController.list));
router.post('/',       requireAuth, wrap(SpellController.create));
router.get('/:id',     requireAuth, wrap(SpellController.getOne));
router.put('/:id',     requireAuth, wrap(SpellController.update));
router.delete('/:id',  requireAuth, wrap(SpellController.remove));

module.exports = router;
