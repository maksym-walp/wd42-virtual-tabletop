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

  // GM/admin only — bulk import of a previously exported or hand-written
  // JSON array. Records without a usable name are silently skipped (same
  // convention as maps/abilities import).
  //
  // Upsert: a record whose "id" matches a species this importer may write
  // to updates it in place; otherwise a record whose "name" matches one
  // (case-insensitive) does. Only existing records the importer could
  // already edit are candidates (own records, or any if admin) — a name
  // collision with someone else's species never overwrites it, a new one
  // is created instead.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив записів' });
    }
    const admin = isAdmin(req.user);
    const existing = await SpeciesModel.findAll(req.user.sub, admin);
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
        await SpeciesModel.update(match.id, fields);
        updated += 1;
      } else {
        await SpeciesModel.create({ createdBy: req.user.sub, ...fields });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const species = await SpeciesModel.setOwner(req.params.id, ownerUsername);
    if (!species) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ species });
  },
};

module.exports = SpeciesController;
