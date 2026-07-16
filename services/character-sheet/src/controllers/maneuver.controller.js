const ManeuverModel = require('../models/maneuver.model');
const { checkPrerequisites, isVisibleToUser } = require('../models/prerequisite.model');
const authorizeCharacterWrite = require('./authorize-character-write');

const ManeuverController = {
  async list(req, res) {
    const maneuvers = await ManeuverModel.findAll(req.params.id);
    res.json({ maneuvers });
  },

  async add(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { maneuver_id } = req.body;
    if (!maneuver_id) return res.status(400).json({ message: 'maneuver_id є обовʼязковим' });
    if (!await isVisibleToUser('maneuvers.entries', maneuver_id, req.user.sub)) {
      return res.status(404).json({ message: 'Маневр не знайдено' });
    }
    const { met, missing } = await checkPrerequisites(req.params.id, 'maneuvers.entries', maneuver_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const maneuver = await ManeuverModel.add(req.params.id, maneuver_id);
    res.status(201).json({ maneuver });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await ManeuverModel.remove(req.params.id, req.params.maneuverId);
    if (!deleted) return res.status(404).json({ message: 'Маневр не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ManeuverController;
