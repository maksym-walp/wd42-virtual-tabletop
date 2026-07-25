const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const LocationController = require('../controllers/location.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(LocationController.listMine));
router.post('/', wrap(LocationController.create));
router.get('/:id', wrap(LocationController.getOne));
router.patch('/:id', wrap(LocationController.update));
router.delete('/:id', wrap(LocationController.remove));

module.exports = router;
