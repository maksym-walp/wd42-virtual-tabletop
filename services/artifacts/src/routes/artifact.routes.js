const express = require('express');
const ArtifactController = require('../controllers/artifact.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/',        requireAuth, wrap(ArtifactController.list));
router.post('/',       requireAuth, wrap(ArtifactController.create));
router.get('/:id',     requireAuth, wrap(ArtifactController.getOne));
router.put('/:id',     requireAuth, wrap(ArtifactController.update));
router.delete('/:id',  requireAuth, wrap(ArtifactController.remove));
router.patch('/:id/canonical', requireCanonicalManager, wrap(ArtifactController.setCanonical));

module.exports = router;
