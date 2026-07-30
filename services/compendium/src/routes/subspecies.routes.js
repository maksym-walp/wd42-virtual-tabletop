const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const SubspeciesController = require('../controllers/subspecies.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(SubspeciesController.list));
router.post('/', wrap(SubspeciesController.create));
router.get('/:id', wrap(SubspeciesController.getOne));
router.patch('/:id', wrap(SubspeciesController.update));
router.delete('/:id', wrap(SubspeciesController.remove));

module.exports = router;
