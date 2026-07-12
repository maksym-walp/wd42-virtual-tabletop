const ProgressModel = require('../models/progress.model');

const ProgressController = {
  async myProgress(req, res) {
    const progress = await ProgressModel.findByUser(req.user.sub);
    res.json({ progress });
  },

  async unlock(req, res) {
    const result = await ProgressModel.unlock(req.user.sub, req.params.nodeId);
    if (!result) return res.status(200).json({ message: 'Вузол вже відкрито' });
    res.status(201).json({ progress: result });
  },

  async lock(req, res) {
    const deleted = await ProgressModel.lock(req.user.sub, req.params.nodeId);
    if (!deleted) return res.status(404).json({ message: 'Вузол не був відкритий' });
    res.json({ message: 'Скасовано' });
  },

  async allProgress(req, res) {
    const progress = await ProgressModel.findAllUsers();
    res.json({ progress });
  },
};

module.exports = ProgressController;
