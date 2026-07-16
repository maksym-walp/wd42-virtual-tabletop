const RitualTrackerModel = require('../models/ritual-tracker.model');
const authorizeCharacterWrite = require('./authorize-character-write');

const RitualTrackerController = {
  async list(req, res) {
    const trackers = await RitualTrackerModel.findAll(req.params.id);
    res.json({ trackers });
  },

  async create(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { name, rounds, participants } = req.body;
    if (!name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const tracker = await RitualTrackerModel.create(req.params.id, { name, rounds, participants });
    res.status(201).json({ tracker });
  },

  async update(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const updated = await RitualTrackerModel.update(req.params.id, req.params.trackerId, req.body);
    if (!updated) return res.status(404).json({ message: 'Трекер не знайдено' });
    res.json({ tracker: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await RitualTrackerModel.delete(req.params.id, req.params.trackerId);
    if (!deleted) return res.status(404).json({ message: 'Трекер не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = RitualTrackerController;
