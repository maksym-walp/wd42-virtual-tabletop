const EntryModel = require('../models/entry.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { decorateEntry } = require('../dto/entry.dto');
const { HEALTH_DICE } = require('../constants/health-dice');

const ENTITY_TYPES = ['npc', 'creature'];
const ATTRIBUTE_KEYS = ['dexterity', 'body', 'intelligence', 'wisdom', 'charisma'];
const GENDERS = ['male', 'female', 'other', 'unspecified'];

// Private notes are lore for the entry's creator and any game master, never
// for a plain visitor even when the entry itself is public — so the entry
// stays visible but this one field gets stripped before it leaves the
// controller for anyone else.
function canSeeNotes(entry, user) {
  return entry.created_by === user.sub || user.role === 'game_master' || isAdmin(user);
}

function scrubNotes(entry, user) {
  if (canSeeNotes(entry, user)) return entry;
  const { private_notes, ...rest } = entry;
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

function validateNpcFields(body, entityType) {
  if (entityType !== 'npc') return { error: null };
  if (body.gender != null && !GENDERS.includes(body.gender)) {
    return { error: `gender має бути одним із: ${GENDERS.join(', ')}` };
  }
  if (body.age != null && (!Number.isInteger(body.age) || body.age < 0)) {
    return { error: 'age має бути цілим невідʼємним числом' };
  }
  if (body.birth_day != null && (!Number.isInteger(body.birth_day) || body.birth_day < 1)) {
    return { error: 'birth_day має бути додатним цілим числом' };
  }
  if (body.health_die_override != null && !HEALTH_DICE.includes(body.health_die_override)) {
    return { error: `health_die_override має бути одним із: ${HEALTH_DICE.join(', ')}` };
  }
  return { error: null };
}

// history ("Походження"/origin) is creature-only; motivation/backstory/
// faction/age/gender/birth date are npc-only. Neither set ever persists on
// the other entity_type's row, regardless of what the client sends.
function toModelFields(body, entityType) {
  const isCreature = entityType === 'creature';
  return {
    name: body.name?.trim(),
    speciesId: body.species_id ?? null,
    subspeciesId: body.subspecies_id ?? null,
    raceId: body.race_id ?? null,
    peopleId: body.people_id ?? null,
    description: body.description ?? null,
    history: isCreature ? (body.history ?? null) : null,
    imageUrl: body.image_url ?? null,
    motivation: isCreature ? null : (body.motivation ?? null),
    backstory: isCreature ? null : (body.backstory ?? null),
    faction: isCreature ? null : (body.faction ?? null),
    isPublic: body.is_public ?? false,
    age: isCreature ? null : (body.age ?? null),
    gender: isCreature ? null : (body.gender ?? null),
    birthCalendarId: isCreature ? null : (body.birth_calendar_id ?? null),
    birthYear: isCreature ? null : (body.birth_year ?? null),
    birthMonthId: isCreature ? null : (body.birth_month_id ?? null),
    birthDay: isCreature ? null : (body.birth_day ?? null),
    healthDieOverride: isCreature ? null : (body.health_die_override ?? null),
    privateNotes: isCreature ? null : (body.private_notes ?? null),
  };
}

const EntryController = {
  async list(req, res) {
    const { entity_type: entityType } = req.query;
    if (entityType && !ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ message: 'entity_type має бути npc або creature' });
    }
    const entries = await EntryModel.findAll(req.user.sub, isAdmin(req.user), entityType);
    res.json({ entries: entries.map((e) => scrubNotes(decorateEntry(e), req.user)) });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name, entity_type: entityType } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ message: 'entity_type має бути npc або creature' });
    }
    const { attributes, error } = validateAttributes(req.body);
    if (error) return res.status(400).json({ message: error });
    const { error: npcError } = validateNpcFields(req.body, entityType);
    if (npcError) return res.status(400).json({ message: npcError });

    const entry = await EntryModel.create({
      createdBy: req.user.sub,
      entityType,
      attributes,
      ...toModelFields(req.body, entityType),
    });
    res.status(201).json({ entry: decorateEntry(entry) });
  },

  async getOne(req, res) {
    const entry = await EntryModel.findById(req.params.id, req.user.sub);
    if (!entry) return res.status(404).json({ message: 'Запис не знайдено' });
    const readable = entry.is_public || entry.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ entry: scrubNotes(decorateEntry(entry), req.user) });
  },

  async update(req, res) {
    const existing = await EntryModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Запис не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    const { attributes, error } = validateAttributes(req.body);
    if (error) return res.status(400).json({ message: error });
    const { error: npcError } = validateNpcFields(req.body, existing.entity_type);
    if (npcError) return res.status(400).json({ message: npcError });

    const entry = await EntryModel.update(existing.id, {
      attributes,
      ...toModelFields(req.body, existing.entity_type),
    });
    res.json({ entry: decorateEntry(entry) });
  },

  async remove(req, res) {
    const existing = await EntryModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Запис не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await EntryModel.remove(existing.id);
    res.status(204).send();
  },

  // Persists a rolled health-dice total — NPCs only. Creatures have no
  // persistent health of their own (campaigns recomputes their average
  // from health_die × body every time it clones one), so there is nothing
  // here for them to store.
  async updateHealth(req, res) {
    const existing = await EntryModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Запис не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    if (existing.entity_type !== 'npc') {
      return res.status(400).json({ message: 'Постійне здоровʼя зберігається лише для НІПів' });
    }

    const { rolled_health: rolledHealth } = req.body;
    if (rolledHealth != null && (!Number.isInteger(rolledHealth) || rolledHealth < 1)) {
      return res.status(400).json({ message: 'rolled_health має бути додатним цілим числом або null' });
    }

    const entry = await EntryModel.updateRolledHealth(existing.id, rolledHealth ?? null);
    res.json({ entry: decorateEntry(entry) });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const entry = await EntryModel.setOwner(req.params.id, ownerUsername);
    if (!entry) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ entry: decorateEntry(entry) });
  },
};

module.exports = EntryController;
