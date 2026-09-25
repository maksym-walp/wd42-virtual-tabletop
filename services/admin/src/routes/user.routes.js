const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const UserController = require('../controllers/user.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireAdmin);

router.get('/', wrap(UserController.list));

module.exports = router;
