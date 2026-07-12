const EdgeModel = require('../models/edge.model');

const EdgeController = {
  async list(req, res) {
    const { archetype } = req.query;
    const edges = await EdgeModel.findAll({ archetype });
    res.json({ edges });
  },

  async update(req, res) {
    const { edge_type } = req.body;
    if (!['required', 'optional'].includes(edge_type)) {
      return res.status(400).json({ message: 'edge_type must be "required" or "optional"' });
    }
    const edge = await EdgeModel.updateType(req.params.id, edge_type);
    if (!edge) return res.status(404).json({ message: 'Звʼязок не знайдено' });
    res.json({ edge });
  },

  async create(req, res) {
    const { source_id, target_id } = req.body;
    if (!source_id || !target_id) {
      return res.status(400).json({ message: 'source_id та target_id обовʼязкові' });
    }
    try {
      const edge = await EdgeModel.create({ source_id, target_id });
      res.status(201).json({ edge });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Звʼязок вже існує' });
      if (err.code === '23503') return res.status(400).json({ message: 'Вузол не знайдено' });
      throw err;
    }
  },

  async remove(req, res) {
    const deleted = await EdgeModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Звʼязок не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = EdgeController;
