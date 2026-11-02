const AbilityModel = require('../models/ability.model');
const { canonicalOnCreate } = require('../middleware/auth.middleware');

// Поля, яких немає (чи не має бути) в експортованому JSON: зображення не
// експортуються (лежать на диску конкретного деплою, ре-імпорт скидає їх у
// NULL), created_at/updated_at/is_owner/owner_username/is_canonical —
// обчислені чи прив'язані до поточного користувача/деплою, а
// prerequisite_node_ids/prerequisite_logic/prerequisite_nodes вказують на
// вузли скіл-дерева конкретного користувача — для перевикористання в іншому
// місці не мають сенсу (той самий підхід, що й у equipment/catalog.controller).
const EXPORT_OMIT_FIELDS = [
  'image_url', 'image_crop', 'created_at', 'updated_at', 'is_owner', 'owner_username',
  'is_canonical', 'prerequisite_node_ids', 'prerequisite_logic', 'prerequisite_nodes',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

const AbilityController = {
  async list(req, res) {
    const { search, sort, archetype, scope, limit, is_maneuver } = req.query;
    const abilities = await AbilityModel.findAll(req.user.sub, { search, sort, archetype, scope, limit, is_maneuver }, req.user.role === 'admin');
    res.json({ abilities });
  },

  async getOne(req, res) {
    const ability = await AbilityModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ ability });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const ability = await AbilityModel.create(req.user.sub, { ...req.body, is_canonical: canonicalOnCreate(req) });
    res.status(201).json({ ability });
  },

  async update(req, res) {
    const ability = await AbilityModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ ability });
  },

  async remove(req, res) {
    const deleted = await AbilityModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's ability canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const ability = await AbilityModel.setCanonical(req.params.id, isCanonical);
    if (!ability) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ ability });
  },

  // Admin only (route-gated) — reassign an ability's owner without changing anything else.
  async setOwner(req, res) {
    const { owner_username } = req.body;
    if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });
    const ability = await AbilityModel.setOwner(req.params.id, owner_username);
    if (!ability) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ ability });
  },

  // Той самий набір фільтрів, що й list, плюс ?id= для експорту рівно
  // одного запису — той самий результат, що дав би /:id, лише обгорнутий у
  // масив з одним елементом.
  async export(req, res) {
    const isAdmin = req.user.role === 'admin';
    let items;
    if (req.query.id) {
      const ability = await AbilityModel.findById(req.query.id, req.user.sub, isAdmin);
      items = ability ? [ability] : [];
    } else {
      const { search, sort, archetype, scope, limit, is_maneuver } = req.query;
      items = await AbilityModel.findAll(req.user.sub, { search, sort, archetype, scope, limit, is_maneuver }, isAdmin);
    }
    res.json(items.map(sanitizeForExport));
  },

  async getRelated(req, res) {
    const related = await AbilityModel.getRelated(req.params.id, req.user.sub, req.user.role === 'admin');
    res.json({ related });
  },

  async addRelated(req, res) {
    const { related_id } = req.body;
    if (!related_id) return res.status(400).json({ message: 'related_id є обовʼязковим' });
    const link = await AbilityModel.addRelated(req.params.id, related_id, req.user.sub, req.user.role === 'admin');
    if (!link) return res.status(404).json({ message: 'Вміння не знайдено або недостатньо прав' });
    res.status(201).json({ link });
  },

  async removeRelated(req, res) {
    const removed = await AbilityModel.removeRelated(req.params.id, req.params.relatedId, req.user.sub, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Зв\'язок не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — масовий імпорт раніше експортованого JSON.
  //
  // Upsert: a record whose "id" or "name" (case-insensitive) matches an
  // ability this importer may already write to (own, or any if admin)
  // updates it in place instead of creating a duplicate. The update keeps
  // that record's prerequisite_node_ids/prerequisite_logic/image_url/
  // image_crop — fields the import never carries (see EXPORT_OMIT_FIELDS) —
  // rather than wiping them.
  async import(req, res) {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив обʼєктів' });
    }
    const isAdmin = req.user.role === 'admin';
    const existing = await AbilityModel.findAll(req.user.sub, {}, isAdmin);
    const writable = isAdmin ? existing : existing.filter((r) => r.user_id === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || !record.name) continue;
      const match = (record.id && byId.get(record.id)) || byName.get(String(record.name).trim().toLowerCase());
      if (match) {
        await AbilityModel.update(match.id, req.user.sub, {
          ...record,
          prerequisite_node_ids: match.prerequisite_node_ids,
          prerequisite_logic: match.prerequisite_logic,
          image_url: match.image_url,
          image_crop: match.image_crop,
        }, isAdmin);
        updated += 1;
      } else {
        await AbilityModel.create(req.user.sub, { ...record, is_canonical: true });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },
};

module.exports = AbilityController;
module.exports.sanitizeForExport = sanitizeForExport;
