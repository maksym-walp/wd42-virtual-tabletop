const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const ConfigController = require('../controllers/config.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireAdmin);

router.get('/',     wrap(ConfigController.list));
router.get('/:key', wrap(ConfigController.getOne));
router.put('/:key', wrap(ConfigController.update));

module.exports = router;
