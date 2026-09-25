const SpellModel = require('../models/spell.model');

// Поля, яких немає (чи не має бути) в експортованому JSON: image_url лежить
// на диску конкретного деплою; created_at/updated_at/is_owner/owner_username/
// is_canonical — обчислені чи прив'язані до поточного користувача/деплою;
// prerequisite_node_ids/prerequisite_logic вказують на конкретні вузли
// skill-tree ЦЬОГО користувача — для іншого імпортера безглузді (bulkImport
// скидає їх до дефолтів, а не довіряє значенням з файлу); prerequisite_nodes/
// traditions — обчислені/приєднані в findAll/findById, не справжні колонки.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'created_at', 'updated_at', 'is_owner', 'owner_username',
  'is_canonical', 'prerequisite_node_ids', 'prerequisite_logic', 'prerequisite_nodes', 'traditions',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

const SpellController = {
  async list(req, res) {
    const { nature, spell_kind, ritual, search, sort, scope, limit, tradition } = req.query;
    const spells = await SpellModel.findAll(req.user.sub, { nature, spellKind: spell_kind, ritual, search, sort, scope, limit, traditionId: tradition }, req.user.role === 'admin');
    res.json({ spells });
  },

  async getOne(req, res) {
    const spell = await SpellModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const spell = await SpellModel.create(req.user.sub, req.body);
    res.status(201).json({ spell });
  },

  async update(req, res) {
    const spell = await SpellModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ spell });
  },

  async remove(req, res) {
    const deleted = await SpellModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's spell canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const spell = await SpellModel.setCanonical(req.params.id, isCanonical);
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  // Admin only (route-gated) — reassign a spell's owner without changing anything else.
  async setOwner(req, res) {
    const { owner_username } = req.body;
    if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });
    const spell = await SpellModel.setOwner(req.params.id, owner_username);
    if (!spell) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ spell });
  },

  // Той самий набір фільтрів, що й у списку (GET /), плюс ?id= для експорту
  // рівно одного запису — той самий результат, що дав би /:id, лише
  // обгорнутий у масив з одним елементом.
  async export(req, res) {
    const isAdmin = req.user.role === 'admin';
    let items;
    if (req.query.id) {
      const spell = await SpellModel.findById(req.query.id, req.user.sub, isAdmin);
      items = spell ? [spell] : [];
    } else {
      const { nature, spell_kind, ritual, search, sort, scope, limit, tradition } = req.query;
      items = await SpellModel.findAll(
        req.user.sub,
        { nature, spellKind: spell_kind, ritual, search, sort, scope, limit, traditionId: tradition },
        isAdmin
      );
    }
    res.json(items.map(sanitizeForExport));
  },

  // GM/admin only (route-gated) — масовий імпорт раніше експортованого JSON.
  async import(req, res) {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив обʼєктів' });
    }
    const imported = await SpellModel.bulkImport(req.user.sub, req.body);
    res.status(201).json({ imported });
  },
};

module.exports = SpellController;
