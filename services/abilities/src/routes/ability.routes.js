const express = require('express');
const AbilityController = require('../controllers/ability.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(AbilityController.list));
router.post('/',       requireAuth, wrap(AbilityController.create));
router.get('/:id',     requireAuth, wrap(AbilityController.getOne));
router.put('/:id',     requireAuth, wrap(AbilityController.update));
router.delete('/:id',  requireAuth, wrap(AbilityController.remove));

module.exports = router;
