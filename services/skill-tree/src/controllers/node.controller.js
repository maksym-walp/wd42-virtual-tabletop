const NodeModel = require('../models/node.model');

const NodeController = {
  async list(req, res) {
    const { race, archetype } = req.query;
    const nodes = await NodeModel.findAll({ race, archetype });
    res.json({ nodes });
  },

  async create(req, res) {
    const node = await NodeModel.create(req.body);
    res.status(201).json({ node });
  },

  async update(req, res) {
    const node = await NodeModel.update(req.params.id, req.body);
    if (!node) return res.status(404).json({ message: 'Вузол не знайдено' });
    res.json({ node });
  },

  async remove(req, res) {
    const deleted = await NodeModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Вузол не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = NodeController;
