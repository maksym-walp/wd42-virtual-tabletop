const SpeciesModel = require('../models/species.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { HEALTH_DICE } = require('../constants/health-dice');

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    isPublic: body.is_public ?? false,
    healthDie: body.health_die ?? 'd6',
  };
}

const SpeciesController = {
  async list(req, res) {
    const species = await SpeciesModel.findAll(req.user.sub, isAdmin(req.user));
    res.json({ species });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name, health_die: healthDie } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (healthDie != null && !HEALTH_DICE.includes(healthDie)) {
      return res.status(400).json({ message: `health_die має бути одним із: ${HEALTH_DICE.join(', ')}` });
    }

    const species = await SpeciesModel.create({ createdBy: req.user.sub, ...toModelFields(req.body) });
    res.status(201).json({ species });
  },

  async getOne(req, res) {
    const species = await SpeciesModel.findById(req.params.id, req.user.sub);
    if (!species) return res.status(404).json({ message: 'Вид не знайдено' });
    const readable = species.is_public || species.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ species });
  },

  async update(req, res) {
    const existing = await SpeciesModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Вид не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name, health_die: healthDie } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (healthDie != null && !HEALTH_DICE.includes(healthDie)) {
      return res.status(400).json({ message: `health_die має бути одним із: ${HEALTH_DICE.join(', ')}` });
    }

    const species = await SpeciesModel.update(existing.id, toModelFields(req.body));
    res.json({ species });
  },

  async remove(req, res) {
    const existing = await SpeciesModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Вид не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await SpeciesModel.remove(existing.id);
    res.status(204).send();
  },
};

module.exports = SpeciesController;
