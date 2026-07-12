const CharacterModel = require('../models/character.model');
const TreeProgressModel = require('../models/tree-progress.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const TreeProgressController = {
  async list(req, res) {
    const progress = await TreeProgressModel.findAll(req.params.id);
    res.json({ progress });
  },

  async unlock(req, res) {
    if (!await assertOwner(req, res)) return;
    const entry = await TreeProgressModel.unlock(req.params.id, req.params.nodeId);
    if (!entry) return res.status(200).json({ message: 'Вузол вже відкрито' });
    res.status(201).json({ progress: entry });
  },

  async lock(req, res) {
    if (!await assertOwner(req, res)) return;
    const deleted = await TreeProgressModel.lock(req.params.id, req.params.nodeId);
    if (!deleted) return res.status(404).json({ message: 'Вузол не був відкритий' });
    res.json({ message: 'Скасовано' });
  },
};

module.exports = TreeProgressController;
