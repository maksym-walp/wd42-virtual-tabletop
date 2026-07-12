const express = require('express');
const ProfileController = require('../controllers/profile.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/me', requireAuth, wrap(ProfileController.getMyProfile));
router.put('/me', requireAuth, wrap(ProfileController.updateMyProfile));

module.exports = router;
