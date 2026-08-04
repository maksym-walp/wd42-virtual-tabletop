const { createCatalogModel, UnionModel, getWeaponOptions } = require('../models/catalog.model');

// Один набір хендлерів на кожен вид спорядження — таблиці різні, поведінка
// однакова, тож контролер параметризований видом, а не скопійований тричі.
function createCatalogController(kind) {
  const Model = createCatalogModel(kind);
  const notFound = `${Model.label} не знайдено`;
  const forbidden = `${Model.label} не знайдено або недостатньо прав`;

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
      const item = await Model.create(req.user.sub, req.body);
      res.status(201).json({ item });
    },

    // Зміна виду спорядження — це переїзд рядка в іншу таблицю зі збереженням
    // id, тож форма завжди шле PUT на ендпоінт ОБРАНОГО виду, навіть якщо
    // запис досі лежить у таблиці попереднього (див. moveKind у моделі).
    async update(req, res) {
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
  };
}

// Поля, яких немає (чи не має бути) в експортованому JSON: зображення не
// експортуються (лежать на диску конкретного деплою, ре-імпорт скидає їх у
// NULL), а created_at/updated_at/is_owner/owner_username/used_in_spells —
// обчислені чи прив'язані до поточного користувача/деплою, тож для
// перевикористання в іншому місці не мають сенсу.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'thumbnail_url', 'created_at', 'updated_at',
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
  async import(req, res) {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив обʼєктів' });
    }
    const imported = await UnionModel.bulkImport(req.user.sub, req.body);
    res.status(201).json({ imported });
  },
};

// Допустимі weapon_type/weapon_grip — тепер редагуються з адмін-панелі, тож
// форма й фільтри зброї підтягують їх звідси, а не з захардкоджених констант.
async function getWeaponOptionsHandler(req, res) {
  res.json(await getWeaponOptions());
}

module.exports = { createCatalogController, UnionController, getWeaponOptionsHandler };
