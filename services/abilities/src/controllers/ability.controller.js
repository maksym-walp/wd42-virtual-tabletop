const AbilityModel = require('../models/ability.model');

const AbilityController = {
  async list(req, res) {
    const { search, sort, archetype, scope } = req.query;
    const abilities = await AbilityModel.findAll(req.user.sub, { search, sort, archetype, scope });
    res.json({ abilities });
  },

  async getOne(req, res) {
    const ability = await AbilityModel.findById(req.params.id, req.user.sub);
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ ability });
  },

  async create(req, res) {
    const ability = await AbilityModel.create(req.user.sub, req.body);
    res.status(201).json({ ability });
  },

  async update(req, res) {
    const ability = await AbilityModel.update(req.params.id, req.user.sub, req.body);
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ ability });
  },

  async remove(req, res) {
    const deleted = await AbilityModel.delete(req.params.id, req.user.sub);
    if (!deleted) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = AbilityController;
