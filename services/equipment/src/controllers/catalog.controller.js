const { createCatalogModel, UnionModel, getWeaponOptions, KINDS } = require('../models/catalog.model');
const { POTION_TIERS, POTION_SIZES, POTION_EFFECTS } = require('../constants/potions');
const { canonicalOnCreate } = require('../middleware/auth.middleware');

// Один набір хендлерів на кожен вид спорядження — таблиці різні, поведінка
// однакова, тож контролер параметризований видом, а не скопійований тричі.
function createCatalogController(kind) {
  const Model = createCatalogModel(kind);
  const notFound = `${Model.label} не знайдено`;
  const forbidden = `${Model.label} не знайдено або недостатньо прав`;

  // Поля з фіксованим набором значень (рівень/розмір/ефект зілля): невідоме
  // значення — 400, а не помилка CHECK у БД.
  const allowed = KINDS[kind].allowed || {};
  const invalidField = (body) => Object.keys(allowed)
    .find((field) => body[field] != null && body[field] !== '' && !allowed[field].includes(body[field]));

  return {
    async list(req, res) {
      const items = await Model.findAll(req.user.sub, req.query, req.user.role === 'admin');
      res.json({ items });
    },

    async getOne(req, res) {
      const item = await Model.findById(req.params.id, req.user.sub, req.user.role === 'admin');
      if (!item) return res.status(404).json({ message: notFound });
      res.json({ item });
    },

    async create(req, res) {
      if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
      const bad = invalidField(req.body);
      if (bad) return res.status(400).json({ message: `Невідоме значення поля ${bad}` });
      const item = await Model.create(req.user.sub, { ...req.body, is_canonical: canonicalOnCreate(req) });
      res.status(201).json({ item });
    },

    // Зміна виду спорядження — це переїзд рядка в іншу таблицю зі збереженням
    // id, тож форма завжди шле PUT на ендпоінт ОБРАНОГО виду, навіть якщо
    // запис досі лежить у таблиці попереднього (див. moveKind у моделі).
    async update(req, res) {
      const bad = invalidField(req.body);
      if (bad) return res.status(400).json({ message: `Невідоме значення поля ${bad}` });
      const item = await Model.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
      if (!item) return res.status(404).json({ message: forbidden });
      res.json({ item });
    },

    async remove(req, res) {
      const deleted = await Model.delete(req.params.id, req.user.sub, req.user.role === 'admin');
      if (!deleted) return res.status(404).json({ message: forbidden });
      res.json({ message: 'Видалено' });
    },

    // GM/admin only (route-gated) — mark someone else's entry canonical.
    async setCanonical(req, res) {
      const isCanonical = req.body.is_canonical ?? true;
      const item = await Model.setCanonical(req.params.id, isCanonical);
      if (!item) return res.status(404).json({ message: notFound });
      res.json({ item });
    },

    // Admin only (route-gated) — reassign an entry's owner without changing anything else.
    async setOwner(req, res) {
      const { owner_username } = req.body;
      if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });
      const item = await Model.setOwner(req.params.id, owner_username);
      if (!item) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
      res.json({ item });
    },
  };
}

// Поля, яких немає (чи не має бути) в експортованому JSON: зображення не
// експортуються (лежать на диску конкретного деплою, ре-імпорт скидає їх у
// NULL), а created_at/updated_at/is_owner/owner_username/used_in_spells —
// обчислені чи прив'язані до поточного користувача/деплою, тож для
// перевикористання в іншому місці не мають сенсу.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'thumbnail_url', 'image_crop', 'created_at', 'updated_at',
  'is_owner', 'owner_username', 'used_in_spells',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

// Читання наскрізь по всіх чотирьох таблицях: спільний список для пікерів
// (лист персонажа, реагенти заклинань) і перехід за голим id, коли вид
// наперед невідомий.
const UnionController = {
  async list(req, res) {
    const { search, scope, sort, dir, limit } = req.query;
    const items = await UnionModel.findAll(req.user.sub, { search, scope, sort, dir, limit }, req.user.role === 'admin');
    res.json({ items });
  },

  async getOne(req, res) {
    const item = await UnionModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!item) return res.status(404).json({ message: 'Спорядження не знайдено' });
    res.json({ item });
  },

  // Той самий набір фільтрів, що й у звичайному каталозі (GET /), плюс ?id=
  // для експорту рівно одного запису — той самий результат, що дав би
  // /:id, лише обгорнутий у масив з одним елементом.
  async export(req, res) {
    const isAdmin = req.user.role === 'admin';
    let items;
    if (req.query.id) {
      const item = await UnionModel.findById(req.query.id, req.user.sub, isAdmin);
      items = item ? [item] : [];
    } else {
      const { search, scope, sort, dir, limit } = req.query;
      items = await UnionModel.findAll(req.user.sub, { search, scope, sort, dir, limit }, isAdmin);
    }
    res.json(items.map(sanitizeForExport));
  },

  // GM/admin only (route-gated) — масовий імпорт раніше експортованого JSON.
  //
  // Upsert: a record whose "id" or "name" (case-insensitive) matches an
  // item this importer may already write to (own, or any if admin)
  // updates it in place instead of creating a duplicate — keeping that
  // item's image_url/thumbnail_url/image_crop, which the import never
  // carries. The update goes through the matched item's own kind's model
  // (falling back to the record's own `type` only when nothing matched),
  // which already knows how to move a row to another kind's table when
  // `type` changed (see createCatalogModel(kind).update -> moveKind).
  async import(req, res) {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив обʼєктів' });
    }
    const isAdmin = req.user.role === 'admin';
    const existing = await UnionModel.findAll(req.user.sub, {}, isAdmin);
    const writable = isAdmin ? existing : existing.filter((r) => r.user_id === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || !record.name) continue;
      const declaredKind = KINDS[record.type] ? record.type : null;
      const match = (record.id && byId.get(record.id)) || byName.get(String(record.name).trim().toLowerCase());
      if (match) {
        const Model = createCatalogModel(declaredKind || match.type);
        await Model.update(match.id, req.user.sub, {
          ...record, image_url: match.image_url, thumbnail_url: match.thumbnail_url, image_crop: match.image_crop,
        }, isAdmin);
        updated += 1;
      } else if (declaredKind) {
        const Model = createCatalogModel(declaredKind);
        await Model.create(req.user.sub, { ...record, is_canonical: true });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },
};

// Допустимі weapon_type/weapon_grip — тепер редагуються з адмін-панелі, тож
// форма й фільтри зброї підтягують їх звідси, а не з захардкоджених констант.
async function getWeaponOptionsHandler(req, res) {
  res.json(await getWeaponOptions());
}

// Рівні (кубик зцілення), розміри (порції) й ефекти зілля для форми й каталогу.
function getPotionOptionsHandler(req, res) {
  res.json({ tiers: POTION_TIERS, sizes: POTION_SIZES, effects: POTION_EFFECTS });
}

module.exports = {
  sanitizeForExport, createCatalogController, UnionController, getWeaponOptionsHandler, getPotionOptionsHandler };
