const ItemModel = require('../models/item.model');

const ItemController = {
  async list(req, res) {
    const { type, weapon_type, armor_weight, search, sort, dir, scope } = req.query;
    const items = await ItemModel.findAll(req.user.sub, {
      type, weaponType: weapon_type, armorWeight: armor_weight, search, sort, dir, scope,
    }, req.user.role === 'admin');
    res.json({ items });
  },

  async getOne(req, res) {
    const item = await ItemModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!item) return res.status(404).json({ message: 'Предмет не знайдено' });
    res.json({ item });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const item = await ItemModel.create(req.user.sub, req.body);
    res.status(201).json({ item });
  },

  async update(req, res) {
    const item = await ItemModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!item) return res.status(404).json({ message: 'Предмет не знайдено або недостатньо прав' });
    res.json({ item });
  },

  async remove(req, res) {
    const deleted = await ItemModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Предмет не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's item canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const item = await ItemModel.setCanonical(req.params.id, isCanonical);
    if (!item) return res.status(404).json({ message: 'Предмет не знайдено' });
    res.json({ item });
  },
};

module.exports = ItemController;
