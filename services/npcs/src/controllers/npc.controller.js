const NpcModel = require('../models/npc.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { isReadable } = require('./visibility');
const { decorateStatBlock } = require('../dto/stat-block.dto');
const { HEALTH_DICE } = require('../constants/health-dice');

const ATTRIBUTE_KEYS = ['dexterity', 'body', 'intelligence', 'wisdom', 'charisma'];
const GENDERS = ['male', 'female', 'other', 'unspecified'];

// Private notes are lore for the NPC's creator and any game master, never
// for a plain visitor even when the NPC itself is public — so the NPC
// stays visible but this one field gets stripped before it leaves the
// controller for anyone else.
function canSeeNotes(npc, user) {
  return npc.created_by === user.sub || user.role === 'game_master' || isAdmin(user);
}

function present(npc, user) {
  const decorated = decorateStatBlock(npc);
  if (canSeeNotes(npc, user)) return decorated;
  const { private_notes, ...rest } = decorated;
  return rest;
}

function validateAttributes(body) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    const value = body[key];
    if (!Number.isInteger(value) || value < 1 || value > 6) {
      return { error: `${key} має бути цілим числом від 1 до 6` };
    }
    attributes[key] = value;
  }
  return { attributes };
}

const isOptionalInt = (value) => value == null || Number.isInteger(value);
const isOptionalPositiveInt = (value) => value == null || (Number.isInteger(value) && value >= 1);

function validateNpcFields(body) {
  if (body.gender != null && !GENDERS.includes(body.gender)) {
    return `gender має бути одним із: ${GENDERS.join(', ')}`;
  }
  if (body.age != null && (!Number.isInteger(body.age) || body.age < 0)) {
    return 'age має бути цілим невідʼємним числом';
  }
  if (!isOptionalInt(body.birth_year) || !isOptionalInt(body.death_year)) {
    return 'Рік має бути цілим числом';
  }
  if (!isOptionalPositiveInt(body.birth_day)) return 'birth_day має бути додатним цілим числом';
  if (!isOptionalPositiveInt(body.death_day)) return 'death_day має бути додатним цілим числом';
  if (body.health_die_override != null && !HEALTH_DICE.includes(body.health_die_override)) {
    return `health_die_override має бути одним із: ${HEALTH_DICE.join(', ')}`;
  }
  return null;
}

// Shared create/update validation; returns { fields } or { error }.
function parseBody(body) {
  if (!body.name || !body.name.trim()) return { error: 'name є обовʼязковим' };
  const { attributes, error } = validateAttributes(body);
  if (error) return { error };
  const npcError = validateNpcFields(body);
  if (npcError) return { error: npcError };
  return {
    fields: {
      name: body.name.trim(),
      speciesId: body.species_id ?? null,
      subspeciesId: body.subspecies_id ?? null,
      raceId: body.race_id ?? null,
      peopleId: body.people_id ?? null,
      description: body.description ?? null,
      motivation: body.motivation ?? null,
      backstory: body.backstory ?? null,
      imageUrl: body.image_url ?? null,
      imageCrop: body.image_crop ?? null,
      healthDieOverride: body.health_die_override ?? null,
      age: body.age ?? null,
      gender: body.gender ?? null,
      birthCalendarId: body.birth_calendar_id ?? null,
      birthYear: body.birth_year ?? null,
      birthMonthId: body.birth_month_id ?? null,
      birthDay: body.birth_day ?? null,
      deathCalendarId: body.death_calendar_id ?? null,
      deathYear: body.death_year ?? null,
      deathMonthId: body.death_month_id ?? null,
      deathDay: body.death_day ?? null,
      privateNotes: body.private_notes ?? null,
      isPublic: body.is_public ?? false,
      attributes,
    },
  };
}

const NpcController = {
  async list(req, res) {
    const npcs = await NpcModel.findAll(req.user.sub, isAdmin(req.user));
    res.json({ npcs: npcs.map((n) => present(n, req.user)) });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати НІПів' });
    }
    const { fields, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const npc = await NpcModel.create({ createdBy: req.user.sub, ...fields });
    res.status(201).json({ npc: present(npc, req.user) });
  },

  async getOne(req, res) {
    const npc = await NpcModel.findById(req.params.id, req.user.sub);
    if (!npc) return res.status(404).json({ message: 'НІПа не знайдено' });
    if (!isReadable(npc, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ npc: present(npc, req.user) });
  },

  async update(req, res) {
    const existing = await NpcModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'НІПа не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { fields, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const npc = await NpcModel.update(existing.id, fields);
    res.json({ npc: present(npc, req.user) });
  },

  async remove(req, res) {
    const existing = await NpcModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'НІПа не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await NpcModel.remove(existing.id);
    res.status(204).send();
  },

  // Persists a rolled health-dice total (campaigns clones it into combat).
  async updateHealth(req, res) {
    const existing = await NpcModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'НІПа не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { rolled_health: rolledHealth } = req.body;
    if (rolledHealth != null && (!Number.isInteger(rolledHealth) || rolledHealth < 1)) {
      return res.status(400).json({ message: 'rolled_health має бути додатним цілим числом або null' });
    }

    const npc = await NpcModel.updateRolledHealth(existing.id, rolledHealth ?? null);
    res.json({ npc: present(npc, req.user) });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const npc = await NpcModel.setOwner(req.params.id, ownerUsername);
    if (!npc) return res.status(404).json({ message: 'НІПа не знайдено або користувача з таким іменем не існує' });
    res.json({ npc: present(npc, req.user) });
  },
};

module.exports = NpcController;
module.exports.present = present;
