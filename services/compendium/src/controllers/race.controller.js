const RaceModel = require('../models/race.model');
const { canCreate, canWrite, isAdmin } = require('./access');

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    isPublic: body.is_public ?? false,
  };
}

const RaceController = {
  async list(req, res) {
    const races = await RaceModel.findAll(req.user.sub, isAdmin(req.user));
    res.json({ races });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const race = await RaceModel.create({ createdBy: req.user.sub, ...toModelFields(req.body) });
    res.status(201).json({ race });
  },

  async getOne(req, res) {
    const race = await RaceModel.findById(req.params.id, req.user.sub);
    if (!race) return res.status(404).json({ message: 'Расу не знайдено' });
    const readable = race.is_public || race.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ race });
  },

  async update(req, res) {
    const existing = await RaceModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Расу не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const race = await RaceModel.update(existing.id, toModelFields(req.body));
    res.json({ race });
  },

  async remove(req, res) {
    const existing = await RaceModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Расу не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await RaceModel.remove(existing.id);
    res.status(204).send();
  },
};

module.exports = RaceController;
