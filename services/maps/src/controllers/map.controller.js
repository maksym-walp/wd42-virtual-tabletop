const MapModel = require('../models/map.model');
const { canCreate, canReadMap, canWriteMap, isAdmin, loadMapOr404 } = require('./access');

function withOwner(map, user) {
  return { ...map, is_owner: map.created_by === user.sub || isAdmin(user) };
}

const MapController = {
  // Maps the user can see: own + public (admin: all).
  async list(req, res) {
    const maps = await MapModel.listVisible(req.user.sub, isAdmin(req.user));
    res.json({ maps });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати мапи' });
    }
    const { name, is_public } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const map = await MapModel.create(req.user.sub, name.trim(), Boolean(is_public));
    res.status(201).json({ map: withOwner(map, req.user) });
  },

  async getOne(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ map: withOwner(map, req.user) });
  },

  async update(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const name = req.body.name ?? map.name;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    const isPublic = req.body.is_public === undefined ? map.is_public : Boolean(req.body.is_public);

    const updated = await MapModel.update(map.id, name.trim(), isPublic);
    res.json({ map: withOwner(updated, req.user) });
  },

  async remove(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await MapModel.remove(map.id);
    res.status(204).send();
  },
};

module.exports = MapController;
