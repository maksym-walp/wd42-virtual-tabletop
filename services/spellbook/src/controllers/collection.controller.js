const CollectionModel = require('../models/collection.model');
const SpellModel = require('../models/spell.model');
const { sanitizeForExport } = require('./spell.controller');
const { canonicalOnCreate } = require('../middleware/auth.middleware');

// Поля колекції, яких немає (чи не має бути) в експортованому JSON — та сама
// логіка, що й для записів у каталозі: зображення лежить на диску конкретного
// деплою, решта — обчислена чи прив'язана до поточного користувача/деплою.
// `items` замінюється повними записами (не урізаним зрізом із findById).
const COLLECTION_EXPORT_OMIT_FIELDS = [
  'image_url', 'image_crop', 'created_at', 'updated_at', 'is_owner', 'owner_username',
  'is_canonical', 'user_id', 'prerequisite_node_ids', 'prerequisite_logic', 'items',
];

function sanitizeCollectionForExport(collection, items) {
  const clean = { ...collection };
  for (const field of COLLECTION_EXPORT_OMIT_FIELDS) delete clean[field];
  return { ...clean, items };
}

const CollectionController = {
  async list(req, res) {
    const { search, scope } = req.query;
    const collections = await CollectionModel.findAll(req.user.sub, { search, scope }, req.user.role === 'admin');
    res.json({ collections });
  },

  async getOne(req, res) {
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    res.json({ collection });
  },

  // Колекція разом з повними записами всередині (а не лише тим зрізом, що
  // віддає getOne): кожен запис добирається тим самим findById, що й у каталозі,
  // тож відповідає формату експорту каталогу. Невидимі користувачу записи
  // (чужі приватні) пропускаються.
  async export(req, res) {
    const isAdmin = req.user.role === 'admin';
    const collection = await CollectionModel.findById(req.params.id, req.user.sub, isAdmin);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    const records = await Promise.all(
      (collection.items || []).map((item) => SpellModel.findById(item.id, req.user.sub, isAdmin))
    );
    res.json(sanitizeCollectionForExport(collection, records.filter(Boolean).map(sanitizeForExport)));
  },

  async getPublic(req, res) {
    const collection = await CollectionModel.findPublicById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або вона приватна' });
    res.json({ collection });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const collection = await CollectionModel.create(req.user.sub, { ...req.body, is_canonical: canonicalOnCreate(req) });
    res.status(201).json({ collection });
  },

  async update(req, res) {
    const collection = await CollectionModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ collection });
  },

  async remove(req, res) {
    const deleted = await CollectionModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Колекцію не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's collection canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const collection = await CollectionModel.setCanonical(req.params.id, isCanonical);
    if (!collection) return res.status(404).json({ message: 'Колекцію не знайдено' });
    res.json({ collection });
  },

  // Admin only (route-gated) — reassign a collection's owner without changing anything else.
  async setOwner(req, res) {
    const { owner_username } = req.body;
    if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });
    const collection = await CollectionModel.setOwner(req.params.id, owner_username);
    if (!collection) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ collection });
  },

  async addItem(req, res) {
    const { spell_id } = req.body;
    if (!spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, spell_id, req.user.role === 'admin');
    if (!added) return res.status(404).json({ message: 'Колекцію або заклинання не знайдено' });
    res.status(201).json({ item: added });
  },

  async removeItem(req, res) {
    const removed = await CollectionModel.removeItem(req.params.id, req.user.sub, req.params.itemId, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CollectionController;
