const CollectionModel = require('../models/collection.model');
const { isAdmin } = require('./access');

const CollectionController = {
  async list(req, res) {
    const { search } = req.query;
    const collections = await CollectionModel.findAll(req.user.sub, { search }, isAdmin(req.user));
    res.json({ collections });
  },

  async getOne(req, res) {
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, isAdmin(req.user));
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
    const collection = await CollectionModel.update(req.params.id, req.user.sub, req.body, isAdmin(req.user));
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ collection });
  },

  async remove(req, res) {
    const deleted = await CollectionModel.delete(req.params.id, req.user.sub, isAdmin(req.user));
    if (!deleted) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  async addItem(req, res) {
    const { entry_id } = req.body;
    if (!entry_id) return res.status(400).json({ message: 'entry_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, entry_id, isAdmin(req.user));
    if (!added) return res.status(404).json({ message: 'Колекцію або запис не знайдено' });
    res.status(201).json({ item: added });
  },

  async removeItem(req, res) {
    const removed = await CollectionModel.removeItem(req.params.id, req.user.sub, req.params.entryId, isAdmin(req.user));
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CollectionController;
