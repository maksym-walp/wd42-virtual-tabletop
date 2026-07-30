const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const SpeciesController = require('../controllers/species.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(SpeciesController.list));
router.post('/', wrap(SpeciesController.create));
router.get('/:id', wrap(SpeciesController.getOne));
router.patch('/:id', wrap(SpeciesController.update));
router.delete('/:id', wrap(SpeciesController.remove));

module.exports = router;
