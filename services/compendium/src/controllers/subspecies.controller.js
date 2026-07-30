const SubspeciesModel = require('../models/subspecies.model');
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

const SubspeciesController = {
  async list(req, res) {
    const subspecies = await SubspeciesModel.findAll(req.user.sub, isAdmin(req.user), req.query.species_id);
    res.json({ subspecies });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name, species_id: speciesId, health_die: healthDie } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!speciesId) return res.status(400).json({ message: 'species_id є обовʼязковим' });
    if (healthDie != null && !HEALTH_DICE.includes(healthDie)) {
      return res.status(400).json({ message: `health_die має бути одним із: ${HEALTH_DICE.join(', ')}` });
    }

    const subspecies = await SubspeciesModel.create({ createdBy: req.user.sub, speciesId, ...toModelFields(req.body) });
    res.status(201).json({ subspecies });
  },

  async getOne(req, res) {
    const subspecies = await SubspeciesModel.findById(req.params.id, req.user.sub);
    if (!subspecies) return res.status(404).json({ message: 'Підвид не знайдено' });
    const readable = subspecies.is_public || subspecies.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ subspecies });
  },

  async update(req, res) {
    const existing = await SubspeciesModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Підвид не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name, health_die: healthDie } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (healthDie != null && !HEALTH_DICE.includes(healthDie)) {
      return res.status(400).json({ message: `health_die має бути одним із: ${HEALTH_DICE.join(', ')}` });
    }

    const subspecies = await SubspeciesModel.update(existing.id, toModelFields(req.body));
    res.json({ subspecies });
  },

  async remove(req, res) {
    const existing = await SubspeciesModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Підвид не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await SubspeciesModel.remove(existing.id);
    res.status(204).send();
  },
};

module.exports = SubspeciesController;
