const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const PeopleController = require('../controllers/people.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get('/', wrap(PeopleController.list));
router.post('/', wrap(PeopleController.create));
router.get('/:id', wrap(PeopleController.getOne));
router.patch('/:id', wrap(PeopleController.update));
router.patch('/:id/owner', wrap(PeopleController.setOwner));
router.delete('/:id', wrap(PeopleController.remove));

module.exports = router;
