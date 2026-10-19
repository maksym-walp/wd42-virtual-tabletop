const CreatureModel = require('../models/creature.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { decorateStatBlock } = require('../dto/stat-block.dto');
const { sanitizeForExport } = require('../dto/export.dto');
const { HEALTH_DICE } = require('../constants/health-dice');

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

// Shared create/update validation; returns { fields } or { error }.
function parseBody(body) {
  if (!body.name || !body.name.trim()) return { error: 'name є обовʼязковим' };
  const { attributes, error } = validateAttributes(body);
  if (error) return { error };
  if (body.health_die_override != null && !HEALTH_DICE.includes(body.health_die_override)) {
    return { error: `health_die_override має бути одним із: ${HEALTH_DICE.join(', ')}` };
  }
  return {
    fields: {
      name: body.name.trim(),
      speciesId: body.species_id ?? null,
      subspeciesId: body.subspecies_id ?? null,
      raceId: body.race_id ?? null,
      peopleId: body.people_id ?? null,
      description: body.description ?? null,
      history: body.history ?? null,
      imageUrl: body.image_url ?? null,
      imageCrop: body.image_crop ?? null,
      healthDieOverride: body.health_die_override ?? null,
      isPublic: body.is_public ?? false,
      attributes,
    },
  };
}

function isReadable(creature, user) {
  return creature.is_public || creature.created_by === user.sub || isAdmin(user);
}

// Імпорт зі /export-подібного JSON: посилання на довідники, що живуть в
// іншому деплої (види, раси, народи, календарі), не мають сенсу — скидаємо їх у
// null (id у файлі належать конкретній базі); зображення не імпортується;
// власник — той, хто імпортує. Усі записи валідуються до першої вставки.
const IMPORT_RESET = { species_id: null, subspecies_id: null, race_id: null, people_id: null, image_url: null, image_crop: null };

function parseImportRecords(records) {
  if (!Array.isArray(records) || !records.length) return { error: 'Очікується непорожній масив обʼєктів' };
  const fieldsList = [];
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { error: `Запис №${index + 1}: очікується обʼєкт` };
    }
    const { fields, error } = parseBody({ ...record, ...IMPORT_RESET });
    if (error) return { error: `Запис №${index + 1}${record.name ? ` («${record.name}»)` : ''}: ${error}` };
    fieldsList.push(fields);
  }
  return { fieldsList };
}

const CreatureController = {
  async list(req, res) {
    const creatures = await CreatureModel.findAll(req.user.sub, isAdmin(req.user));
    res.json({ creatures: creatures.map(decorateStatBlock) });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати істот' });
    }
    const { fields, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const creature = await CreatureModel.create({ createdBy: req.user.sub, ...fields });
    res.status(201).json({ creature: decorateStatBlock(creature) });
  },

  // GM/адмін: масовий імпорт раніше експортованих записів. Лоудаут, стосунки
  // та фракції не імпортуються — лише власні поля запису.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може імпортувати записи' });
    }
    const { fieldsList, error } = parseImportRecords(req.body);
    if (error) return res.status(400).json({ message: error });

    const ids = await CreatureModel.importMany(req.user.sub, fieldsList);
    res.status(201).json({ imported: ids.length });
  },

  // Один запис у форматі POST /import (масив з одного елемента) — той самий,
  // що й записи в експорті колекції.
  async export(req, res) {
    const creature = await CreatureModel.findById(req.params.id, req.user.sub);
    if (!creature) return res.status(404).json({ message: 'Істоту не знайдено' });
    if (!isReadable(creature, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json([sanitizeForExport(decorateStatBlock(creature))]);
  },

  async getOne(req, res) {
    const creature = await CreatureModel.findById(req.params.id, req.user.sub);
    if (!creature) return res.status(404).json({ message: 'Істоту не знайдено' });
    if (!isReadable(creature, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ creature: decorateStatBlock(creature) });
  },

  async update(req, res) {
    const existing = await CreatureModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Істоту не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { fields, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const creature = await CreatureModel.update(existing.id, fields);
    res.json({ creature: decorateStatBlock(creature) });
  },

  async remove(req, res) {
    const existing = await CreatureModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Істоту не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await CreatureModel.remove(existing.id);
    res.status(204).send();
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const creature = await CreatureModel.setOwner(req.params.id, ownerUsername);
    if (!creature) return res.status(404).json({ message: 'Істоту не знайдено або користувача з таким іменем не існує' });
    res.json({ creature: decorateStatBlock(creature) });
  },
};

module.exports = CreatureController;
module.exports.parseImportRecords = parseImportRecords;
