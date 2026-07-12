const { rollFormula } = require('../formula');
const RollModel = require('../models/roll.model');

const RollController = {
  async create(req, res) {
    const { formula } = req.body;
    if (!formula || typeof formula !== 'string') {
      return res.status(400).json({ message: 'formula є обовʼязковим полем' });
    }

    const result = rollFormula(formula);
    const saved = await RollModel.create(req.user.sub, result);
    res.status(201).json({ roll: saved });
  },

  async list(req, res) {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const rolls = await RollModel.findHistory(req.user.sub, { limit, offset });
    res.json({ rolls });
  },

  async stats(req, res) {
    const stats = await RollModel.getStats(req.user.sub);
    res.json({ stats });
  },
};

module.exports = RollController;
