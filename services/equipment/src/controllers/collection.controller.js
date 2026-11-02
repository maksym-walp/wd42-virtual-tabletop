const CollectionModel = require('../models/collection.model');
const { UnionModel, KINDS, createCatalogModel } = require('../models/catalog.model');
const { sanitizeForExport } = require('./catalog.controller');
const { canonicalOnCreate, CANONICAL_ROLES } = require('../middleware/auth.middleware');

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

function validateImportPayload(payload) {
  if (!payload.length) return 'Очікується обʼєкт колекції або непорожній масив';
  for (const data of payload) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.name) {
      return 'Кожна колекція має бути обʼєктом із полем name';
    }
    if (data.items == null) continue;
    if (!Array.isArray(data.items)) return `Колекція «${data.name}»: items має бути масивом`;
    for (const item of data.items) {
      if (!item || typeof item !== 'object' || !item.name) {
        return `Колекція «${data.name}»: кожен запис у items має мати name`;
      }
      if (!KINDS[item.type]) {
        return `Колекція «${data.name}», «${item.name}»: невідомий type (очікується ${Object.keys(KINDS).join(', ')})`;
      }
    }
  }
  return null;
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
      (collection.items || []).map((item) => UnionModel.findById(item.id, req.user.sub, isAdmin))
    );
    res.json(sanitizeCollectionForExport(collection, records.filter(Boolean).map(sanitizeForExport)));
  },

  // Імпорт раніше експортованої колекції (один обʼєкт або масив) разом із
  // вкладеними записами (`items`, формат експорту каталогу). Колекцію може
  // імпортувати будь-хто; вкладені записи — лише ГМ/адмін (як і каталожний
  // імпорт, вони стають канонічними), решті `items` пропускається.
  //
  // Upsert: a collection whose "id" or "name" (case-insensitive) matches
  // one this importer may already write to updates it in place rather
  // than creating a duplicate; likewise each item inside `items` that
  // matches one of the importer's own catalog entries (own, or any if
  // admin) updates it instead of creating a duplicate — going through the
  // matched item's own kind's model, which already knows how to move a row
  // to another kind's table when `type` changed. A matched collection's
  // item set is fully replaced by this import's `items` (same whole-
  // object-replace convention as elsewhere) — the matched/created entries
  // themselves are never deleted, only unlinked from the collection.
  async import(req, res) {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const problem = validateImportPayload(payload);
    if (problem) return res.status(400).json({ message: problem });

    const isAdmin = req.user.role === 'admin';
    const canImportItems = CANONICAL_ROLES.includes(req.user.role);

    const existingCollections = await CollectionModel.findAll(req.user.sub, {}, isAdmin);
    const writableCollections = isAdmin ? existingCollections : existingCollections.filter((c) => c.user_id === req.user.sub);
    const collectionById = new Map(writableCollections.map((c) => [c.id, c]));
    const collectionByName = new Map(writableCollections.map((c) => [c.name.trim().toLowerCase(), c]));

    const existingItems = canImportItems ? await UnionModel.findAll(req.user.sub, {}, isAdmin) : [];
    const writableItems = isAdmin ? existingItems : existingItems.filter((i) => i.user_id === req.user.sub);
    const itemById = new Map(writableItems.map((i) => [i.id, i]));
    const itemByName = new Map(writableItems.map((i) => [i.name.trim().toLowerCase(), i]));

    const collections = [];
    let createdItems = 0;
    let updatedItems = 0;
    let itemsSkipped = 0;
    let createdCollections = 0;
    let updatedCollections = 0;

    for (const data of payload) {
      const items = data.items ?? [];
      const matchColl = (data.id && collectionById.get(data.id)) || collectionByName.get(String(data.name).trim().toLowerCase());

      let collection;
      if (matchColl) {
        collection = await CollectionModel.update(matchColl.id, req.user.sub, {
          name: data.name, description: data.description, is_public: data.is_public,
          prerequisite_node_ids: matchColl.prerequisite_node_ids, prerequisite_logic: matchColl.prerequisite_logic,
          image_url: matchColl.image_url, image_crop: matchColl.image_crop,
        }, isAdmin);
        updatedCollections += 1;
      } else {
        collection = await CollectionModel.create(req.user.sub, {
          name: data.name, description: data.description, is_public: data.is_public, is_canonical: canonicalOnCreate(req),
        });
        createdCollections += 1;
      }

      if (!canImportItems) {
        itemsSkipped += items.length;
      } else if (items.length) {
        try {
          const itemRefs = [];
          for (const item of items) {
            const matchItem = (item.id && itemById.get(item.id)) || itemByName.get(String(item.name).trim().toLowerCase());
            if (matchItem) {
              const kind = KINDS[item.type] ? item.type : matchItem.type;
              await createCatalogModel(kind).update(matchItem.id, req.user.sub, {
                ...item, image_url: matchItem.image_url, thumbnail_url: matchItem.thumbnail_url, image_crop: matchItem.image_crop,
              }, isAdmin);
              itemRefs.push({ id: matchItem.id, type: kind });
              updatedItems += 1;
            } else {
              const createdItem = await createCatalogModel(item.type).create(req.user.sub, { ...item, is_canonical: true });
              itemRefs.push({ id: createdItem.id, type: item.type });
              createdItems += 1;
            }
          }
          await CollectionModel.replaceItems(collection.id, itemRefs);
        } catch (err) {
          if (!matchColl) await CollectionModel.discard(collection.id);
          throw err;
        }
      }
      collections.push(collection);
    }

    res.status(201).json({
      collections,
      imported_items: createdItems + updatedItems,
      created_items: createdItems,
      updated_items: updatedItems,
      items_skipped: itemsSkipped,
      created_collections: createdCollections,
      updated_collections: updatedCollections,
    });
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
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ message: 'item_id є обовʼязковим' });
    const added = await CollectionModel.addItem(req.params.id, req.user.sub, item_id, req.user.role === 'admin');
    if (!added) return res.status(404).json({ message: 'Колекцію або предмет не знайдено' });
    res.status(201).json({ item: added });
  },

  async removeItem(req, res) {
    const removed = await CollectionModel.removeItem(req.params.id, req.user.sub, req.params.itemId, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CollectionController;
