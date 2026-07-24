const SpellModel = require('../models/spell.model');

const SpellController = {
  async list(req, res) {
    const { nature, spell_kind, ritual, search, sort, scope, limit, tradition } = req.query;
    const spells = await SpellModel.findAll(req.user.sub, { nature, spellKind: spell_kind, ritual, search, sort, scope, limit, traditionId: tradition }, req.user.role === 'admin');
    res.json({ spells });
  },

  async getOne(req, res) {
    const spell = await SpellModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const spell = await SpellModel.create(req.user.sub, req.body);
    res.status(201).json({ spell });
  },

  async update(req, res) {
    const spell = await SpellModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ spell });
  },

  async remove(req, res) {
    const deleted = await SpellModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's spell canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const spell = await SpellModel.setCanonical(req.params.id, isCanonical);
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },
};

module.exports = SpellController;
