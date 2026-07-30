const EntryModel = require('../models/entry.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { decorateEntry } = require('../dto/entry.dto');

const ENTITY_TYPES = ['npc', 'creature'];
const ATTRIBUTE_KEYS = ['dexterity', 'body', 'intelligence', 'wisdom', 'charisma'];

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

// history ("Походження"/origin) is creature-only; motivation/backstory/
// faction are npc-only. Neither set ever persists on the other entity_type's
// row, regardless of what the client sends.
function toModelFields(body, entityType) {
  const isCreature = entityType === 'creature';
  return {
    name: body.name?.trim(),
    speciesId: body.species_id ?? null,
    subspeciesId: body.subspecies_id ?? null,
    description: body.description ?? null,
    history: isCreature ? (body.history ?? null) : null,
    imageUrl: body.image_url ?? null,
    motivation: isCreature ? null : (body.motivation ?? null),
    backstory: isCreature ? null : (body.backstory ?? null),
    faction: isCreature ? null : (body.faction ?? null),
    isPublic: body.is_public ?? false,
  };
}

const EntryController = {
  async list(req, res) {
    const { entity_type: entityType } = req.query;
    if (entityType && !ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ message: 'entity_type має бути npc або creature' });
    }
    const entries = await EntryModel.findAll(req.user.sub, isAdmin(req.user), entityType);
    res.json({ entries: entries.map(decorateEntry) });
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
    res.json({ entry: decorateEntry(entry) });
  },

  async update(req, res) {
    const existing = await EntryModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Запис не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    const { attributes, error } = validateAttributes(req.body);
    if (error) return res.status(400).json({ message: error });

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
};

module.exports = EntryController;
