const ManeuverModel = require('../models/maneuver.model');

const ManeuverController = {
  async list(req, res) {
    const { search, sort, scope, limit } = req.query;
    const maneuvers = await ManeuverModel.findAll(req.user.sub, { search, sort, scope, limit }, req.user.role === 'admin');
    res.json({ maneuvers });
  },

  async getOne(req, res) {
    const maneuver = await ManeuverModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!maneuver) return res.status(404).json({ message: 'Маневр не знайдено' });
    res.json({ maneuver });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const maneuver = await ManeuverModel.create(req.user.sub, req.body);
    res.status(201).json({ maneuver });
  },

  async update(req, res) {
    const maneuver = await ManeuverModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!maneuver) return res.status(404).json({ message: 'Маневр не знайдено або недостатньо прав' });
    res.json({ maneuver });
  },

  async remove(req, res) {
    const deleted = await ManeuverModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Маневр не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's maneuver canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const maneuver = await ManeuverModel.setCanonical(req.params.id, isCanonical);
    if (!maneuver) return res.status(404).json({ message: 'Маневр не знайдено' });
    res.json({ maneuver });
  },
};

module.exports = ManeuverController;
