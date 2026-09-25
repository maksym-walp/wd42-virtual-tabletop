const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const RaceController = require('../controllers/race.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(RaceController.list));
router.post('/', wrap(RaceController.create));
router.get('/:id', wrap(RaceController.getOne));
router.patch('/:id', wrap(RaceController.update));
router.patch('/:id/owner', wrap(RaceController.setOwner));
router.delete('/:id', wrap(RaceController.remove));

module.exports = router;
