const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const RollController = require('../controllers/roll.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.post('/rolls', wrap(RollController.create));
router.get('/rolls', wrap(RollController.list));
router.get('/stats', wrap(RollController.stats));

module.exports = router;
