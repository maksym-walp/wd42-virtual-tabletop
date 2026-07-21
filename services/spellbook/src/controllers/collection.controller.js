const CollectionModel = require('../models/collection.model');

const CollectionController = {
  async list(req, res) {
    const { search, scope } = req.query;
    const collections = await CollectionModel.findAll(req.user.sub, { search, scope }, req.user.role === 'admin');
    res.json({ collections });
  },

  async getOne(req, res) {
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    res.json({ collection });
  },

  async getPublic(req, res) {
    const collection = await CollectionModel.findPublicById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або вона приватна' });
    res.json({ collection });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const collection = await CollectionModel.create(req.user.sub, req.body);
    res.status(201).json({ collection });
  },

  async update(req, res) {
    const collection = await CollectionModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ collection });
  },

  async remove(req, res) {
    const deleted = await CollectionModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's collection canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const collection = await CollectionModel.setCanonical(req.params.id, isCanonical);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    res.json({ collection });
  },

  async addItem(req, res) {
    const { spell_id } = req.body;
    if (!spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, spell_id, req.user.role === 'admin');
    if (!added) return res.status(404).json({ message: 'Колекцію або заклинання не знайдено' });
    res.status(201).json({ item: added });
  },

  async removeItem(req, res) {
    const removed = await CollectionModel.removeItem(req.params.id, req.user.sub, req.params.itemId, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CollectionController;
