const CharacterModel = require('../models/character.model');
const RitualTrackerModel = require('../models/ritual-tracker.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const RitualTrackerController = {
  async list(req, res) {
    const trackers = await RitualTrackerModel.findAll(req.params.id);
    res.json({ trackers });
  },

  async create(req, res) {
    if (!await assertOwner(req, res)) return;
    const { name, rounds, participants } = req.body;
    if (!name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const tracker = await RitualTrackerModel.create(req.params.id, { name, rounds, participants });
    res.status(201).json({ tracker });
  },

  async update(req, res) {
    if (!await assertOwner(req, res)) return;
    const updated = await RitualTrackerModel.update(req.params.id, req.params.trackerId, req.body);
    if (!updated) return res.status(404).json({ message: 'Трекер не знайдено' });
    res.json({ tracker: updated });
  },

  async remove(req, res) {
    if (!await assertOwner(req, res)) return;
    const deleted = await RitualTrackerModel.delete(req.params.id, req.params.trackerId);
    if (!deleted) return res.status(404).json({ message: 'Трекер не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = RitualTrackerController;
