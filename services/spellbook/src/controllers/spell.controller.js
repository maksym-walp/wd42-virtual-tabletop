const SpellModel = require('../models/spell.model');

const SpellController = {
  async list(req, res) {
    const { magic_type, spell_kind, ritual, search, sort, scope } = req.query;
    const spells = await SpellModel.findAll(req.user.sub, { magicType: magic_type, spellKind: spell_kind, ritual, search, sort, scope });
    res.json({ spells });
  },

  async getOne(req, res) {
    const spell = await SpellModel.findById(req.params.id, req.user.sub);
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const spell = await SpellModel.create(req.user.sub, req.body);
    res.status(201).json({ spell });
  },

  async update(req, res) {
    const spell = await SpellModel.update(req.params.id, req.user.sub, req.body);
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ spell });
  },

  async remove(req, res) {
    const deleted = await SpellModel.delete(req.params.id, req.user.sub);
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = SpellController;
