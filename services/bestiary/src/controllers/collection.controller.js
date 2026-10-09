const CollectionModel = require('../models/collection.model');
const CreatureModel = require('../models/creature.model');
const { decorateStatBlock } = require('../dto/stat-block.dto');
const { isAdmin } = require('./access');

// Поля, яких немає (чи не має бути) в експортованому JSON: зображення лежить
// на диску конкретного деплою, решта — службові/обчислені чи прив'язані до
// поточного користувача. Спільне для колекції й записів у ній.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'image_crop', 'created_at', 'updated_at', 'is_owner', 'owner_username', 'created_by',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

const CollectionController = {
  async list(req, res) {
    const { search } = req.query;
    const collections = await CollectionModel.findAll(req.user.sub, { search }, isAdmin(req.user));
    res.json({ collections });
  },

  async getOne(req, res) {
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, isAdmin(req.user));
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    res.json({ collection });
  },

  // Колекція разом з повними записами всередині (а не лише тим зрізом, що
  // віддає getOne): кожен запис добирається тим самим findById, що й у каталозі.
  // Невидимі користувачу записи (чужі приватні) пропускаються.
  async export(req, res) {
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, isAdmin(req.user));
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    const records = await Promise.all(
      (collection.items || []).map((item) => CreatureModel.findById(item.id, req.user.sub))
    );
    const items = records
      .filter((record) => record && (record.is_public || record.created_by === req.user.sub || isAdmin(req.user)))
      .map((record) => sanitizeForExport(decorateStatBlock(record)));
    res.json({ ...sanitizeForExport(collection), items });
  },

  async getPublic(req, res) {
    const collection = await CollectionModel.findPublicById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або вона приватна' });
    res.json({ collection });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const collection = await CollectionModel.create(req.user.sub, req.body);
    res.status(201).json({ collection });
  },

  async update(req, res) {
    const collection = await CollectionModel.update(req.params.id, req.user.sub, req.body, isAdmin(req.user));
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ collection });
  },

  async remove(req, res) {
    const deleted = await CollectionModel.delete(req.params.id, req.user.sub, isAdmin(req.user));
    if (!deleted) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  async addItem(req, res) {
    const { creature_id } = req.body;
    if (!creature_id) return res.status(400).json({ message: 'creature_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, creature_id, isAdmin(req.user));
    if (!added) return res.status(404).json({ message: 'Колекцію або запис не знайдено' });
    res.status(201).json({ item: added });
  },

  async removeItem(req, res) {
    const removed = await CollectionModel.removeItem(req.params.id, req.user.sub, req.params.entryId, isAdmin(req.user));
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const collection = await CollectionModel.setOwner(req.params.id, ownerUsername);
    if (!collection) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ collection });
  },
};

module.exports = CollectionController;
