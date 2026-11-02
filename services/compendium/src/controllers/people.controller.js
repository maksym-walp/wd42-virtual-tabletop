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

  // GM/admin only — bulk import scoped to one race, same ?race_id= query
  // the GET list uses (the frontend calls this from that race's detail
  // page, so every imported record shares its parent). Records without a
  // usable name are silently skipped.
  //
  // Upsert: a record whose "id" or "name" (case-insensitive) matches a
  // people of THIS race that the importer may already write to updates it
  // in place instead of creating a duplicate.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const raceId = req.query.race_id;
    if (!raceId) return res.status(400).json({ message: 'race_id є обовʼязковим' });
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив записів' });
    }
    const admin = isAdmin(req.user);
    const existing = await PeopleModel.findAll(req.user.sub, admin, raceId);
    const writable = admin ? existing : existing.filter((r) => r.created_by === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || typeof record.name !== 'string' || !record.name.trim()) continue;
      const fields = {
        name: record.name.trim(),
        description: typeof record.description === 'string' ? record.description : null,
        origin: typeof record.origin === 'string' ? record.origin : null,
        isPublic: record.is_public ?? false,
      };
      const match = (record.id && byId.get(record.id)) || byName.get(fields.name.toLowerCase());
      if (match) {
        await PeopleModel.update(match.id, fields);
        updated += 1;
      } else {
        await PeopleModel.create({ createdBy: req.user.sub, raceId, ...fields });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const people = await PeopleModel.setOwner(req.params.id, ownerUsername);
    if (!people) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ people });
  },
};

module.exports = PeopleController;
