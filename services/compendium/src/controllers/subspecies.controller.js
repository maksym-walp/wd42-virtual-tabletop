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

  // GM/admin only — bulk import scoped to one species, same ?species_id=
  // query the GET list uses (the frontend calls this from that species'
  // detail page, so every imported record shares its parent). Records
  // without a usable name are silently skipped.
  //
  // Upsert: a record whose "id" or "name" (case-insensitive) matches a
  // subspecies of THIS species that the importer may already write to
  // updates it in place instead of creating a duplicate.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const speciesId = req.query.species_id;
    if (!speciesId) return res.status(400).json({ message: 'species_id є обовʼязковим' });
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив записів' });
    }
    const admin = isAdmin(req.user);
    const existing = await SubspeciesModel.findAll(req.user.sub, admin, speciesId);
    const writable = admin ? existing : existing.filter((r) => r.created_by === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || typeof record.name !== 'string' || !record.name.trim()) continue;
      const healthDie = HEALTH_DICE.includes(record.health_die) ? record.health_die : 'd6';
      const fields = {
        name: record.name.trim(),
        description: typeof record.description === 'string' ? record.description : null,
        isPublic: record.is_public ?? false,
        healthDie,
      };
      const match = (record.id && byId.get(record.id)) || byName.get(fields.name.toLowerCase());
      if (match) {
        await SubspeciesModel.update(match.id, fields);
        updated += 1;
      } else {
        await SubspeciesModel.create({ createdBy: req.user.sub, speciesId, ...fields });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const subspecies = await SubspeciesModel.setOwner(req.params.id, ownerUsername);
    if (!subspecies) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ subspecies });
  },
};

module.exports = SubspeciesController;
