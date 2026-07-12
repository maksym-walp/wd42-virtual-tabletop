const express = require('express');
const NodeController = require('../controllers/node.controller');
const EdgeController = require('../controllers/edge.controller');
const TreeController = require('../controllers/tree.controller');
const { requireAuth, requireGameMaster } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Nodes — read for all (with optional ?race= / ?archetype= filter), write for game_master
router.get('/nodes',        requireAuth,       wrap(NodeController.list));
router.post('/nodes',       requireGameMaster, wrap(NodeController.create));
router.put('/nodes/:id',    requireGameMaster, wrap(NodeController.update));
router.delete('/nodes/:id', requireGameMaster, wrap(NodeController.remove));

// Edges — read for all, write for game_master
router.get('/edges',        requireAuth,       wrap(EdgeController.list));
router.post('/edges',       requireGameMaster, wrap(EdgeController.create));
router.patch('/edges/:id',  requireGameMaster, wrap(EdgeController.update));
router.delete('/edges/:id', requireGameMaster, wrap(EdgeController.remove));

// Export / Import (export readable by all auth users, import GM only)
router.get('/export',  requireAuth,       wrap(TreeController.export));
router.post('/import', requireGameMaster, wrap(TreeController.import));

module.exports = router;
