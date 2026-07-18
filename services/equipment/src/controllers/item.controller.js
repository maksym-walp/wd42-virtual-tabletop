const ItemModel = require('../models/item.model');

const ItemController = {
  async list(req, res) {
    const { type, weapon_type, armor_weight, search, sort, dir, scope } = req.query;
    const items = await ItemModel.findAll(req.user.sub, {
      type, weaponType: weapon_type, armorWeight: armor_weight, search, sort, dir, scope,
    });
    res.json({ items });
  },

  async getOne(req, res) {
    const item = await ItemModel.findById(req.params.id, req.user.sub);
    if (!item) return res.status(404).json({ message: 'Предмет не знайдено' });
    res.json({ item });
  },

  async create(req, res) {
    const item = await ItemModel.create(req.user.sub, req.body);
    res.status(201).json({ item });
  },

  async update(req, res) {
    const item = await ItemModel.update(req.params.id, req.user.sub, req.body);
    if (!item) return res.status(404).json({ message: 'Предмет не знайдено або недостатньо прав' });
    res.json({ item });
  },

  async remove(req, res) {
    const deleted = await ItemModel.delete(req.params.id, req.user.sub);
    if (!deleted) return res.status(404).json({ message: 'Предмет не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ItemController;
