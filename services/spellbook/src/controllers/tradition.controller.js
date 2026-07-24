const TraditionModel = require('../models/tradition.model');

const TraditionController = {
  async list(req, res) {
    const traditions = await TraditionModel.findAll({ search: req.query.search });
    res.json({ traditions });
  },
  async getOne(req, res) {
    const tradition = await TraditionModel.findById(req.params.id);
    if (!tradition) return res.status(404).json({ message: 'Традицію не знайдено' });
    res.json({ tradition });
  },
  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const tradition = await TraditionModel.create(req.user.sub, req.body);
    res.status(201).json({ tradition });
  },
  async update(req, res) {
    const tradition = await TraditionModel.update(req.params.id, req.body);
    if (!tradition) return res.status(404).json({ message: 'Традицію не знайдено' });
    res.json({ tradition });
  },
  async remove(req, res) {
    const deleted = await TraditionModel.delete(req.params.id, req.user.sub);
    if (!deleted) return res.status(404).json({ message: 'Традицію не знайдено' });
    res.json({ message: 'Видалено' });
  },
  async addSpell(req, res) {
    if (!req.body.spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    const added = await TraditionModel.addSpell(req.params.id, req.user.sub, req.body.spell_id, req.user.role === 'admin');
    if (!added) return res.status(404).json({ message: 'Традицію або заклинання не знайдено, або недостатньо прав' });
    res.status(201).json({ item: added });
  },
  async removeSpell(req, res) {
    const removed = await TraditionModel.removeSpell(req.params.id, req.user.sub, req.params.spellId, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = TraditionController;
