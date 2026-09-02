const TreeProgressModel = require('../models/tree-progress.model');
const authorizeCharacterWrite = require('./authorize-character-write');

const TreeProgressController = {
  async list(req, res) {
    const progress = await TreeProgressModel.findAll(req.params.id);
    res.json({ progress });
  },

  async unlock(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const check = await TreeProgressModel.canUnlock(req.params.id, req.params.nodeId);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const { progress, granted } = await TreeProgressModel.unlock(req.params.id, req.params.nodeId);
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
