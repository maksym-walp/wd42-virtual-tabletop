const RaceModel = require('../models/race.model');
const { canCreate, canWrite, isAdmin } = require('./access');

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    isPublic: body.is_public ?? false,
    imageUrl: body.image_url || null,
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

  // GM/admin only — bulk import of a previously exported or hand-written
  // JSON array. Records without a usable name are silently skipped.
  //
  // Upsert: a record whose "id" or "name" (case-insensitive) matches a
  // race this importer may already write to updates it in place instead
  // of creating a duplicate — image_url is left as the existing record's
  // (the import never carries one) rather than wiped to null.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив записів' });
    }
    const admin = isAdmin(req.user);
    const existing = await RaceModel.findAll(req.user.sub, admin);
    const writable = admin ? existing : existing.filter((r) => r.created_by === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || typeof record.name !== 'string' || !record.name.trim()) continue;
      const name = record.name.trim();
      const description = typeof record.description === 'string' ? record.description : null;
      const isPublic = record.is_public ?? false;
      const match = (record.id && byId.get(record.id)) || byName.get(name.toLowerCase());
      if (match) {
        await RaceModel.update(match.id, { name, description, isPublic, imageUrl: match.image_url });
        updated += 1;
      } else {
        await RaceModel.create({ createdBy: req.user.sub, name, description, isPublic, imageUrl: null });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const race = await RaceModel.setOwner(req.params.id, ownerUsername);
    if (!race) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ race });
  },
};

module.exports = RaceController;
