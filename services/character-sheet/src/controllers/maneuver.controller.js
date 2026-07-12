const CharacterModel = require('../models/character.model');
const ManeuverModel = require('../models/maneuver.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const ManeuverController = {
  async list(req, res) {
    const maneuvers = await ManeuverModel.findAll(req.params.id);
    res.json({ maneuvers });
  },

  async add(req, res) {
    if (!await assertOwner(req, res)) return;
    const { maneuver_id } = req.body;
    if (!maneuver_id) return res.status(400).json({ message: 'maneuver_id є обовʼязковим' });
    const maneuver = await ManeuverModel.add(req.params.id, maneuver_id);
    res.status(201).json({ maneuver });
  },

  async remove(req, res) {
    if (!await assertOwner(req, res)) return;
    const deleted = await ManeuverModel.remove(req.params.id, req.params.maneuverId);
    if (!deleted) return res.status(404).json({ message: 'Маневр не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ManeuverController;
