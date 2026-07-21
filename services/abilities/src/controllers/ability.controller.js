const AbilityModel = require('../models/ability.model');

const AbilityController = {
  async list(req, res) {
    const { search, sort, archetype, scope, limit } = req.query;
    const abilities = await AbilityModel.findAll(req.user.sub, { search, sort, archetype, scope, limit }, req.user.role === 'admin');
    res.json({ abilities });
  },

  async getOne(req, res) {
    const ability = await AbilityModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ ability });
  },

  async create(req, res) {
    const ability = await AbilityModel.create(req.user.sub, req.body);
    res.status(201).json({ ability });
  },

  async update(req, res) {
    const ability = await AbilityModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ ability });
  },

  async remove(req, res) {
    const deleted = await AbilityModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's ability canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const ability = await AbilityModel.setCanonical(req.params.id, isCanonical);
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ ability });
  },
};

module.exports = AbilityController;
