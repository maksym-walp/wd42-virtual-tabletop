const TreeProgressModel = require('../models/tree-progress.model');
const authorizeCharacterWrite = require('./authorize-character-write');

const TreeProgressController = {
  async list(req, res) {
    const progress = await TreeProgressModel.findAll(req.params.id);
    res.json({ progress });
  },

  async unlock(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    // via: 'points' | 'narrative' — which unlock route the player picked.
    const check = await TreeProgressModel.canUnlock(req.params.id, req.params.nodeId, req.body?.via);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const { progress, granted, insufficient } = await TreeProgressModel.unlock(req.params.id, req.params.nodeId, check.spend);
    if (insufficient) return res.status(403).json({ message: 'Недостатньо пунктів досвіду' });
    if (!progress) return res.status(200).json({ message: 'Вузол вже відкрито' });
    res.status(201).json({ progress, granted });
  },

  async lock(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await TreeProgressModel.lock(req.params.id, req.params.nodeId);
    if (!deleted) return res.status(404).json({ message: 'Вузол не був відкритий' });
    res.json({ message: 'Скасовано' });
  },
};

module.exports = TreeProgressController;
