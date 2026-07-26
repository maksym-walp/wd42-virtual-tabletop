const { createCatalogModel, UnionModel } = require('../models/catalog.model');

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

// Читання наскрізь по всіх трьох таблицях: спільний список для пікерів
// (лист персонажа, реагенти заклинань) і перехід за голим id, коли вид
// наперед невідомий.
const UnionController = {
  async list(req, res) {
    const { search, scope, sort, dir } = req.query;
    const items = await UnionModel.findAll(req.user.sub, { search, scope, sort, dir }, req.user.role === 'admin');
    res.json({ items });
  },

  async getOne(req, res) {
    const item = await UnionModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!item) return res.status(404).json({ message: 'Спорядження не знайдено' });
    res.json({ item });
  },
};

module.exports = { createCatalogController, UnionController };
