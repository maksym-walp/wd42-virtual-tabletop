const CollectionModel = require('../models/collection.model');
const NpcModel = require('../models/npc.model');
const { present } = require('./npc.controller');
const { isAdmin, canCreate } = require('./access');
const { parseImportRecords } = require('./npc.controller');

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

function validateImportPayload(payload) {
  if (!payload.length) return 'Очікується обʼєкт колекції або непорожній масив';
  for (const data of payload) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.name) {
      return 'Кожна колекція має бути обʼєктом із полем name';
    }
    if (data.items != null && !Array.isArray(data.items)) return `Колекція «${data.name}»: items має бути масивом`;
  }
  return null;
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
      (collection.items || []).map((item) => NpcModel.findById(item.id, req.user.sub))
    );
    const items = records
      .filter((record) => record && (record.is_public || record.created_by === req.user.sub || isAdmin(req.user)))
      .map((record) => sanitizeForExport(present(record, req.user)));
    res.json({ ...sanitizeForExport(collection), items });
  },

  // Імпорт раніше експортованої колекції (один обʼєкт або масив) разом із
  // вкладеними записами (`items`, формат експорту каталогу). Колекцію може
  // імпортувати будь-хто; вкладені записи — лише ГМ/адмін (як і створення
  // записів у каталозі), решті `items` пропускається.
  async import(req, res) {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const problem = validateImportPayload(payload);
    if (problem) return res.status(400).json({ message: problem });

    const canImportItems = canCreate(req.user);
    const parsed = payload.map((data) => (canImportItems && data.items?.length ? parseImportRecords(data.items) : { fieldsList: [] }));
    const invalid = parsed.findIndex((p) => p.error);
    if (invalid !== -1) {
      return res.status(400).json({ message: `Колекція «${payload[invalid].name}»: ${parsed[invalid].error}` });
    }

    const collections = [];
    let importedItems = 0;
    let itemsSkipped = 0;

    for (const [index, data] of payload.entries()) {
      const collection = await CollectionModel.create(req.user.sub, {
        name: data.name,
        description: data.description,
        is_public: data.is_public,
      });
      if (!canImportItems) {
        itemsSkipped += data.items?.length ?? 0;
      } else if (parsed[index].fieldsList.length) {
        try {
          const ids = await NpcModel.importMany(req.user.sub, parsed[index].fieldsList);
          await CollectionModel.addItemsUnchecked(collection.id, ids);
          importedItems += ids.length;
        } catch (err) {
          await CollectionModel.discard(collection.id);
          throw err;
        }
      }
      collections.push(collection);
    }

    res.status(201).json({ collections, imported_items: importedItems, items_skipped: itemsSkipped });
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
    const { npc_id } = req.body;
    if (!npc_id) return res.status(400).json({ message: 'npc_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, npc_id, isAdmin(req.user));
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
