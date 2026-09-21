const PeopleModel = require('../models/people.model');
const { canCreate, canWrite, isAdmin } = require('./access');

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    origin: body.origin ?? null,
    isPublic: body.is_public ?? false,
  };
}

const PeopleController = {
  async list(req, res) {
    const peoples = await PeopleModel.findAll(req.user.sub, isAdmin(req.user), req.query.race_id);
    res.json({ peoples });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name, race_id: raceId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!raceId) return res.status(400).json({ message: 'race_id є обовʼязковим' });

    const people = await PeopleModel.create({ createdBy: req.user.sub, raceId, ...toModelFields(req.body) });
    res.status(201).json({ people });
  },

  async getOne(req, res) {
    const people = await PeopleModel.findById(req.params.id, req.user.sub);
    if (!people) return res.status(404).json({ message: 'Народ не знайдено' });
    const readable = people.is_public || people.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ people });
  },

  async update(req, res) {
    const existing = await PeopleModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Народ не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const people = await PeopleModel.update(existing.id, toModelFields(req.body));
    res.json({ people });
  },

  async remove(req, res) {
    const existing = await PeopleModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Народ не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await PeopleModel.remove(existing.id);
    res.status(204).send();
  },
};

module.exports = PeopleController;
